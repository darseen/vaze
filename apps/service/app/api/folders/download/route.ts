import { db } from "@/db";
import { archiveName, streamZipResponse, type ZipEntry } from "@/lib/zip";
import { parseTimestamp } from "@/utils";
import { files as filesTable, folders as foldersTable } from "@repo/db";
import type { Folder } from "@repo/types";
import { and, asc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { ensureRootFolder, normalizeKey, toStoragePath } from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:read",
    });
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    const key = searchParams.get("key");

    let folder: Folder | undefined;
    if (id) {
      folder = db
        .select()
        .from(foldersTable)
        .where(and(eq(foldersTable.id, id), isNull(foldersTable.deletedAt)))
        .get();
    } else if (key !== null) {
      folder = db
        .select()
        .from(foldersTable)
        .where(
          and(
            eq(foldersTable.key, normalizeKey(key)),
            isNull(foldersTable.deletedAt),
          ),
        )
        .get();
    } else {
      folder = await ensureRootFolder();
    }

    if (!folder) {
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    const name = archiveName(folder.key);
    const entries: ZipEntry[] = [];
    await collectEntries(folder, name, entries);

    return streamZipResponse(entries, name);
  } catch (error) {
    console.error("error downloading folder:", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}

async function collectEntries(
  folder: Folder,
  prefix: string,
  entries: ZipEntry[],
) {
  entries.push({
    type: "directory",
    name: prefix,
    mtime: parseTimestamp(folder.updatedAt),
  });

  const files = db
    .select()
    .from(filesTable)
    .where(
      and(eq(filesTable.folderId, folder.id), isNull(filesTable.deletedAt)),
    )
    .orderBy(asc(filesTable.name))
    .all();

  const fileStats = await Promise.all(
    files.map((file) => stat(toStoragePath(file.key)).catch(() => null)),
  );

  files.forEach((file, index) => {
    const stats = fileStats[index];
    // a row whose file is gone from disk must not fail the whole folder
    if (!stats?.isFile()) return;

    entries.push({
      type: "file",
      name: `${prefix}/${file.name}`,
      path: toStoragePath(file.key),
      size: stats.size,
      mtime: stats.mtime,
    });
  });

  const subfolders = db
    .select()
    .from(foldersTable)
    .where(
      and(eq(foldersTable.parentId, folder.id), isNull(foldersTable.deletedAt)),
    )
    .orderBy(asc(foldersTable.name))
    .all();

  for (const subfolder of subfolders) {
    await collectEntries(subfolder, `${prefix}/${subfolder.name}`, entries);
  }
}
