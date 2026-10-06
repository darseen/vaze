import { parentKeyOf, toStoragePath } from "@/app/api/_utils";
import { MAX_DOWNLOAD_BATCH } from "@/constants";
import { db } from "@/db";
import { archiveName, streamZipResponse, type ZipEntry } from "@/lib/zip";
import { files as filesTable } from "@repo/db";
import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import authorizeRequest from "../../_utils/authorize-request";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    let requested: unknown;
    try {
      requested = await readIds(request);
    } catch {
      return NextResponse.json(
        { data: null, error: { message: "Invalid request body" } },
        { status: 400 },
      );
    }

    const ids = [
      ...new Set(
        (Array.isArray(requested) ? requested : []).filter(
          (value): value is string => typeof value === "string" && value !== "",
        ),
      ),
    ];

    if (ids.length === 0) {
      return NextResponse.json(
        { data: null, error: { message: "No file ids provided" } },
        { status: 400 },
      );
    }

    if (ids.length > MAX_DOWNLOAD_BATCH) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `Cannot download more than ${MAX_DOWNLOAD_BATCH} files at once`,
          },
        },
        { status: 400 },
      );
    }

    const files = db
      .select()
      .from(filesTable)
      .where(inArray(filesTable.id, ids))
      .all()
      .sort((a, b) => (a.key < b.key ? -1 : 1));

    const fileStats = await Promise.all(
      files.map((file) => stat(toStoragePath(file.key)).catch(() => null)),
    );

    // every requested file must be in the archive, or the caller gets nothing
    if (
      files.length !== ids.length ||
      fileStats.some((stats) => !stats?.isFile())
    ) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const base = commonFolderKey(files.map((file) => parentKeyOf(file.key)));

    const entries: ZipEntry[] = files.map((file, index) => ({
      type: "file",
      name: base ? file.key.slice(base.length + 1) : file.key,
      path: toStoragePath(file.key),
      size: fileStats[index]!.size,
      mtime: fileStats[index]!.mtime,
    }));

    return streamZipResponse(entries, archiveName(base));
  } catch (error) {
    console.error("error downloading files:", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}

// form fields let the dashboard hand the zip straight to the browser's downloads
async function readIds(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    return (await request.formData()).getAll("ids");
  }

  const body = await request.json();
  return body?.ids;
}

/** Deepest folder containing every key, so entries keep only the paths that differ. */
function commonFolderKey(folderKeys: string[]): string {
  const [first, ...rest] = folderKeys.map((key) => (key ? key.split("/") : []));
  let length = first.length;

  for (const segments of rest) {
    let index = 0;
    while (index < length && segments[index] === first[index]) index++;
    length = index;
  }

  return first.slice(0, length).join("/");
}
