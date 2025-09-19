import { BASE_UPLOADS_PATH } from "@/constants";
import db, { Folder } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import authorizeRequest from "../_utils/authorize-request";

export default async function GET(request: NextRequest) {
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
