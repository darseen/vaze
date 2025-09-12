import { BASE_UPLOADS_PATH } from "@/constants";
import db, { Folder } from "@/db";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import authorizeRequest from "../_utils/authorize-request";

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const folderPath = searchParams.get("path");

    // if nothing is provided, fetch the root folder and its files and folders
    if (!id && !folderPath) {
      let folder = db
        .prepare(`SELECT * FROM folders WHERE path = ?`)
        .get(BASE_UPLOADS_PATH) as Folder | undefined;

      // if the root folder doesn't exist, create it.
      if (!folder) {
        db.prepare(
          `INSERT OR IGNORE INTO folders (id, name, path) VALUES (?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          path.basename(BASE_UPLOADS_PATH),
          BASE_UPLOADS_PATH,
        );

        folder = db
          .prepare(`SELECT * FROM folders WHERE path = ?`)
          .get(BASE_UPLOADS_PATH) as Folder;
      }

      const searchPattern = path.join(folder.path, "%");
      const excludePattern = path.join(folder.path, "%/%");

      const folders = db
        .prepare(
          `
            SELECT * FROM folders 
            WHERE path LIKE ? 
            AND path NOT LIKE ?
            AND path != ?
          `,
        )
        .all(searchPattern, excludePattern, folder.path) as Folder[];

      const files = db
        .prepare(`SELECT * FROM files WHERE folder_id = ?`)
        .all(folder.id) as File[];

      return NextResponse.json({
        data: { files, folders },
        error: null,
      });
    }

    // if id is provided, fetch the folder with the given id
    if (id) {
      const folder = db
        .prepare(`SELECT * FROM folders WHERE id = ?`)
        .get(id) as Folder | undefined;

      if (!folder) {
        return NextResponse.json(
          { data: null, error: { message: "Folder not found" } },
          { status: 404 },
        );
      }

      // fetch files in folder
      const files = db
        .prepare(`SELECT * FROM files WHERE folder_id = ?`)
        .all(folder.id) as File[];

      // fetch subfolders in folder
      const searchPattern = path.join(folder.path, "%");
      const excludePattern = path.join(folder.path, "%/%");

      const folders = db
        .prepare(
          `
            SELECT * FROM folders 
            WHERE path LIKE ? 
            AND path NOT LIKE ?
            AND path != ?
          `,
        )
        .all(searchPattern, excludePattern, folder.path) as Folder[];

      return NextResponse.json({ data: { files, folders }, error: null });
    }

    if (folderPath) {
      const folder = db
        .prepare(`SELECT * FROM folders WHERE path = ?`)
        .get(path.join(BASE_UPLOADS_PATH, folderPath)) as Folder | undefined;

      if (!folder) {
        return NextResponse.json(
          { data: null, error: { message: "Folder not found" } },
          { status: 404 },
        );
      }

      // fetch files in folder
      const files = db
        .prepare(`SELECT * FROM files WHERE folder_id = ?`)
        .all(folder.id) as File[];

      // fetch subfolders in folder
      const searchPattern = path.join(folder.path, "%");
      const excludePattern = path.join(folder.path, "%/%");

      const folders = db
        .prepare(
          `
            SELECT * FROM folders 
            WHERE path LIKE ? 
            AND path NOT LIKE ?
            AND path != ?
          `,
        )
        .all(searchPattern, excludePattern, folder.path) as Folder[];

      return NextResponse.json({ data: { files, folders }, error: null });
    }

    // throw an error if somehow all the if's didn't trigger, just in case.
    throw new Error("Invalid request");
  } catch (error) {
    console.log("fetch folders error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

// export async function PUT(request: NextRequest) {}

// export async function DELETE(request: NextRequest) {}
