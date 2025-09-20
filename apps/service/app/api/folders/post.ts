import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { Folder } from "@repo/types";
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

    if (folder.includes(".")) {
      return NextResponse.json(
        { error: { message: "Folder name cannot contain dots" }, data: null },
        { status: 400 },
      );
    }

    folderAbsolutePath = path.join(BASE_UPLOADS_PATH, folder);

    const fullPathExistsOnDisk = await fs
      .access(folderAbsolutePath)
      .then(() => true)
      .catch(() => false);

    const fullPathExistsInDB = db
      .prepare(`SELECT id FROM folders WHERE path = ?`)
      .get(folderAbsolutePath);

    if (fullPathExistsOnDisk || fullPathExistsInDB) {
      return NextResponse.json(
        { data: null, error: { message: "Folder already exists" } },
        { status: 409 },
      );
    }

    const pathSegments = folder.split("/").filter(Boolean); // filter(Boolean) removes empty strings
    let currentPath = BASE_UPLOADS_PATH;
    let currentParentId: string | null = null; // root folder has a null parent_id

    for (const segment of pathSegments) {
      const segmentAbsolutePath = path.join(currentPath, segment);

      // check if segment already exists.
      const existingSegment = db
        .prepare(`SELECT id FROM folders WHERE path = ?`)
        .get(segmentAbsolutePath) as Pick<Folder, "id"> | undefined;

      if (existingSegment) {
        // if it exists, just update the state for the next iteration.
        currentPath = segmentAbsolutePath;
        currentParentId = existingSegment.id;
      } else {
        // if it doesn't exist, create it.

        // create on disk
        await fs.mkdir(segmentAbsolutePath);
        // create in database
        const newSegmentId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO folders (id, name, path, parent_id) VALUES (?, ?, ?, ?)`,
        ).run(newSegmentId, segment, segmentAbsolutePath, currentParentId);

        // update state for the next iteration
        currentPath = segmentAbsolutePath;
        currentParentId = newSegmentId;
      }
    }

    // fetch the newly created folder to return it.
    const newFolder = db
      .prepare(`SELECT * FROM folders WHERE path = ?`)
      .get(folderAbsolutePath) as Folder | undefined;

    if (!newFolder) {
      // this should ideally not be reached if the loop logic is correct.
      throw new Error(
        "Failed to create or find the folder in the database after creation.",
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: { folder: newFolder }, error: null });
  } catch (error) {
    console.log("create folder error ", error);
    if (folderAbsolutePath) {
      db.prepare(`DELETE FROM folders WHERE path = ?`).run(folderAbsolutePath);
    }
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
