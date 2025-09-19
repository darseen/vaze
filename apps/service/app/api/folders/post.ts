import { BASE_UPLOADS_PATH } from "@/constants";
import db, { Folder } from "@/db";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import authorizeRequest from "../_utils/authorize-request";

export default async function POST(request: NextRequest) {
  let folderAbsolutePath: string | null = null;

  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    // folder is a name like "folder" but could be a path like "folder/subfolder"
    const { folder }: { folder: string } = await request.json();

    if (!folder) {
      return NextResponse.json(
        { data: null, error: { message: "Missing folder" } },
        { status: 400 },
      );
    }

    // check if folder contains any dots
    if (folder.includes(".")) {
      return NextResponse.json(
        { error: { message: "Folder name cannot contain dots" }, data: null },
        { status: 400 },
      );
    }

    folderAbsolutePath = path.join(BASE_UPLOADS_PATH, folder);

    try {
      await fs.access(folderAbsolutePath, fs.constants.F_OK);

      return NextResponse.json(
        { data: null, error: { message: "Folder already exists" } },
        { status: 409 },
      );
    } catch {
      // folder doesn't exist on disk
    }

    // check in database
    const folderInDB = db
      .prepare(`SELECT * FROM folders WHERE path = ?`)
      .get(folderAbsolutePath) as Folder | undefined;

    if (folderInDB) {
      return NextResponse.json(
        { data: null, error: { message: "Folder already exists" } },
        { status: 409 },
      );
    }

    const pathSegments = folder.split("/");
    let currentPath = BASE_UPLOADS_PATH;

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];

      const segmentAbsolutePath = path.join(currentPath, segment);
      const segmentParentAbsolutePath = path.dirname(segmentAbsolutePath);
      let parentId: string | null = null;

      // check if segment folder exists
      try {
        await fs.access(segmentAbsolutePath, fs.constants.F_OK);
        const folder = db
          .prepare(`SELECT * FROM folders WHERE path = ?`)
          .get(segmentAbsolutePath) as Folder | undefined;
        if (!folder) throw new Error();

        // folder exists, continue to next segment
        continue;
      } catch {}

      // check if parent folder exists
      try {
        await fs.access(segmentParentAbsolutePath, fs.constants.F_OK);

        const parentFolder = db
          .prepare(`SELECT * FROM folders WHERE path = ?`)
          .get(segmentParentAbsolutePath) as Folder | undefined;
        if (!parentFolder) throw new Error();

        parentId = parentFolder.id;
      } catch {
        // create parent folder on disk
        await fs.mkdir(segmentParentAbsolutePath);

        // create parent folder in database
        db.prepare(
          `INSERT INTO folders (id, name, path, parent_id) VALUES (?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          path.basename(segmentParentAbsolutePath),
          segmentParentAbsolutePath,
          parentId,
        );

        const parentFolder = db
          .prepare(`SELECT id FROM folders WHERE path = ?`)
          .get(segmentParentAbsolutePath) as Pick<Folder, "id"> | undefined;

        if (!parentFolder) throw new Error();

        parentId = parentFolder.id;
      }

      // create segment folder on disk
      await fs.mkdir(segmentAbsolutePath);

      // create segment folder in database
      db.prepare(
        `INSERT INTO folders (id, name, path, parent_id) VALUES (?, ?, ?, ?)`,
      ).run(
        crypto.randomUUID(),
        path.basename(segmentAbsolutePath),
        segmentAbsolutePath,
        parentId,
      );

      currentPath = segmentAbsolutePath;
    }

    // fetch folder
    const newFolder = db
      .prepare(`SELECT * FROM folders WHERE path = ?`)
      .get(folderAbsolutePath) as Folder | undefined;

    if (!newFolder) throw new Error();

    revalidatePath("/dashboard");
    return NextResponse.json({ data: { folder: newFolder }, error: null });
  } catch (error) {
    console.log("create folder error ", error);
    // delete folder from database
    db.prepare(`DELETE FROM folders WHERE path = ?`).run(folderAbsolutePath);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
