import { BASE_UPLOADS_PATH } from "@/constants";
import { db } from "@/db";
import { files as filesTable, folders as foldersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import crypto from "node:crypto";
import {
  fetchFolderByPath,
  fileOrderBy,
  getFilesWithUrls,
  OrderBy,
  OrderDirection,
  parseIntParam,
} from "../_utils";
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
    const orderBy = searchParams.get("orderBy") || "createdAt";
    const orderDirection = searchParams.get("orderDirection") || "DESC";

    const safeOrderBy = (
      ["createdAt", "updatedAt", "name", "size"].includes(orderBy)
        ? orderBy
        : "createdAt"
    ) as OrderBy;
    const safeOrderDirection = (
      ["ASC", "DESC"].includes(orderDirection.toUpperCase())
        ? orderDirection.toUpperCase()
        : "DESC"
    ) as OrderDirection;

    // if nothing is provided, fetch the root folder and its files and folders
    if (!id && !folderPath) {
      let folder = db
        .select()
        .from(foldersTable)
        .where(eq(foldersTable.path, BASE_UPLOADS_PATH))
        .get();

      // if the root folder doesn't exist, create it.
      if (!folder) {
        db.insert(foldersTable)
          .values({
            id: crypto.randomUUID(),
            name: path.basename(BASE_UPLOADS_PATH),
            path: BASE_UPLOADS_PATH,
          })
          .onConflictDoNothing()
          .run();

        folder = db
          .select()
          .from(foldersTable)
          .where(eq(foldersTable.path, BASE_UPLOADS_PATH))
          .get();
      }

      const { files, folders } = fetchFolderContents(folder!.id, {
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
        .select()
        .from(foldersTable)
        .where(eq(foldersTable.id, id))
        .get();

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
    safeOrderBy: OrderBy;
    safeOrderDirection: OrderDirection;
  },
) {
  const { limit, offset, safeOrderBy, safeOrderDirection } = options;

  const files = db
    .select()
    .from(filesTable)
    .where(eq(filesTable.folderId, folderId))
    .orderBy(fileOrderBy(safeOrderBy, safeOrderDirection))
    .limit(limit)
    .offset(offset)
    .all();

  const folders = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.parentId, folderId))
    .all();

  return { files, folders };
}
