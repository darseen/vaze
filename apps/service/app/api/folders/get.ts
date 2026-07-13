import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { File, Folder } from "@repo/types";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import crypto from "node:crypto";
import { fetchFolderByPath, getFilesWithUrls, parseIntParam } from "../_utils";
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
    const limit = parseIntParam(searchParams.get("limit"), -1);
    const offset = parseIntParam(searchParams.get("offset"), 0);
    const orderBy = searchParams.get("orderBy") || "created_at";
    const orderDirection = searchParams.get("orderDirection") || "DESC";

    const safeOrderBy = (
      ["created_at", "updated_at", "name", "size"].includes(orderBy)
        ? orderBy
        : "created_at"
    ) as "created_at" | "updated_at" | "name" | "size";
    const safeOrderDirection = (
      ["ASC", "DESC"].includes(orderDirection.toUpperCase())
        ? orderDirection.toUpperCase()
        : "DESC"
    ) as "ASC" | "DESC";

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

      const { files, folders } = fetchFolderContents(folder.id, {
        limit,
        offset,
        safeOrderBy,
        safeOrderDirection,
      });

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

      const { files, folders } = fetchFolderContents(folder.id, {
        limit,
        offset,
        safeOrderBy,
        safeOrderDirection,
      });

      return NextResponse.json({
        data: { files: getFilesWithUrls(files), folders },
        error: null,
      });
    }

    if (folderPath) {
      const { error, data } = await fetchFolderByPath(folderPath, {
        limit,
        offset,
        safeOrderBy,
        safeOrderDirection,
      });
      return NextResponse.json(
        { data, error },
        { status: error ? 404 : 200 },
      );
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

// fetch the files and direct subfolders of a folder by id
function fetchFolderContents(
  folderId: string,
  options: {
    limit: number;
    offset: number;
    safeOrderBy: "created_at" | "updated_at" | "name" | "size";
    safeOrderDirection: "ASC" | "DESC";
  },
) {
  const { limit, offset, safeOrderBy, safeOrderDirection } = options;

  const files = db
    .prepare(
      `SELECT * FROM files WHERE folder_id = ? ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
    )
    .all(folderId, limit, offset) as File[];

  const folders = db
    .prepare(`SELECT * FROM folders WHERE parent_id = ?`)
    .all(folderId) as Folder[];

  return { files, folders };
}
