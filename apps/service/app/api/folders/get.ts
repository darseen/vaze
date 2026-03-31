import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { File, Folder } from "@repo/types";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { fetchFolderByPath, getFilesWithUrls } from "../_utils";
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
    const limit = parseInt(searchParams.get("limit") || "-1");
    const offset = parseInt(searchParams.get("offset") || "0");
    const orderBy = searchParams.get("orderBy") || "created_at";
    const orderDirection = searchParams.get("orderDirection") || "desc";

    const safeOrderBy = ["created_at", "updated_at", "name"].includes(orderBy)
      ? orderBy
      : "created_at";
    const safeOrderDirection = ["ASC", "DESC"].includes(
      orderDirection.toUpperCase(),
    )
      ? orderDirection
      : "DESC";

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
        .prepare(
          `SELECT * FROM files WHERE folder_id = ? ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
        )
        .all(folder.id, limit, offset) as File[];

      return NextResponse.json({
        data: { files: getFilesWithUrls(files), folders },
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
        .prepare(
          `SELECT * FROM files WHERE folder_id = ? ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
        )
        .all(folder.id, limit, offset) as File[];

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

      return NextResponse.json({
        data: { files: getFilesWithUrls(files), folders },
        error: null,
      });
    }

    if (folderPath) {
      const { error, data } = await fetchFolderByPath(folderPath);
      return NextResponse.json({ data, error });
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
