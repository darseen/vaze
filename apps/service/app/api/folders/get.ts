import { db } from "@/db";
import { folders as foldersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureRootFolder,
  fetchFolderByKey,
  fetchFolderContents,
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
        { status: authError.status },
      );
    }

    const searchParams = request.nextUrl.searchParams;

    const id = searchParams.get("id");
    // `path` is kept as an alias so existing callers keep working
    const folderKey = searchParams.get("key") ?? searchParams.get("path");
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

    const options = { limit, offset, safeOrderBy, safeOrderDirection };

    // by id
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

      const { files, folders } = fetchFolderContents(folder.id, options);

      return NextResponse.json({
        data: { files: getFilesWithUrls(files), folders },
        error: null,
      });
    }

    // by key
    if (folderKey) {
      const { error, data } = await fetchFolderByKey(folderKey, options);
      return NextResponse.json({ data, error }, { status: error ? 404 : 200 });
    }

    // neither given — the root folder and its contents
    const root = await ensureRootFolder();
    const { files, folders } = fetchFolderContents(root.id, options);

    return NextResponse.json({
      data: { files: getFilesWithUrls(files), folders },
      error: null,
    });
  } catch (error) {
    console.error("fetch folders error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
