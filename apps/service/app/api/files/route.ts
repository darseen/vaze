import {
  BASE_DATA_PATH,
  BASE_TMP_PATH,
  DEFAULT_FILE_VISIBILITY,
} from "@/constants";
import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import type { File as FileDB, Folder } from "@repo/types";
import { getAvailableStorage } from "@/utils/storage";
import { and, eq, ne, sql } from "drizzle-orm";
import mime from "mime-types";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  accessPath,
  createNestedFolders,
  fileOrderBy,
  getFilesWithUrls,
  isValidName,
  joinKey,
  normalizeKey,
  OrderBy,
  OrderDirection,
  parentKeyOf,
  parseIntParam,
  parseVisibility,
  revalidateDashboard,
  toStoragePath,
} from "../_utils";
import authorizeRequest from "../_utils/authorize-request";
import {
  parseMultipartToDisk,
  TooManyFilesError,
  UploadTooLargeError,
} from "../_utils/multipart";

export async function GET(request: NextRequest) {
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
    const name = searchParams.get("name");
    const key = searchParams.get("key");
    const limit = parseIntParam(searchParams.get("limit"), -1);
    const offset = parseIntParam(searchParams.get("offset"), 0);
    const orderBy = searchParams.get("orderBy") || "createdAt";
    const orderDirection = searchParams.get("orderDirection") || "DESC";

    const safeOrderBy: OrderBy = (
      ["createdAt", "updatedAt", "name", "size"] as const
    ).includes(orderBy as OrderBy)
      ? (orderBy as OrderBy)
      : "createdAt";
    const safeOrderDirection: OrderDirection = ["ASC", "DESC"].includes(
      orderDirection.toUpperCase(),
    )
      ? (orderDirection.toUpperCase() as OrderDirection)
      : "DESC";

    if (id || key) {
      const file = db
        .select()
        .from(filesTable)
        .where(id ? eq(filesTable.id, id) : eq(filesTable.key, normalizeKey(key)))
        .get();

      if (!file) {
        return NextResponse.json(
          { data: null, error: { message: "File not found" } },
          { status: 404 },
        );
      }

      return NextResponse.json({
        data: { file: getFilesWithUrls([file])[0] },
        error: null,
      });
    }

    const files = db
      .select()
      .from(filesTable)
      .where(name ? eq(filesTable.name, name) : undefined)
      .orderBy(fileOrderBy(safeOrderBy, safeOrderDirection))
      .limit(limit)
      .offset(offset)
      .all();

    // zero matches is a valid search result, not an error
    return NextResponse.json({
      data: { files: getFilesWithUrls(files) },
      error: null,
    });
  } catch (error) {
    console.error("get files error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const stagingDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
  const committedPaths: string[] = [];

  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          error: { message: "Expected a multipart/form-data body" },
          data: null,
        },
        { status: 400 },
      );
    }

    // Reject before reading the body when the volume clearly cannot hold it.
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredSize) && declaredSize > 0) {
      const available = await getAvailableStorage(BASE_DATA_PATH);
      if (available > 0 && declaredSize > available) {
        return NextResponse.json(
          { error: { message: "Not enough free space" }, data: null },
          { status: 507 },
        );
      }
    }

    await fs.mkdir(stagingDir, { recursive: true });

    let parsed;
    try {
      parsed = await parseMultipartToDisk(request, stagingDir);
    } catch (error) {
      if (error instanceof UploadTooLargeError) {
        return NextResponse.json(
          { error: { message: error.message }, data: null },
          { status: 413 },
        );
      }
      if (error instanceof TooManyFilesError) {
        return NextResponse.json(
          { error: { message: error.message }, data: null },
          { status: 413 },
        );
      }
      throw error;
    }

    const { fields, files: staged } = parsed;

    if (staged.length === 0) {
      return NextResponse.json(
        { error: { message: "Missing required fields" }, data: null },
        { status: 400 },
      );
    }

    for (const file of staged) {
      if (!isValidName(file.originalName)) {
        return NextResponse.json(
          {
            error: { message: `Invalid file name: ${file.originalName}` },
            data: null,
          },
          { status: 400 },
        );
      }
    }

    // duplicate names inside one request would race each other onto the same key
    const names = staged.map((file) => file.originalName);
    if (new Set(names).size !== names.length) {
      return NextResponse.json(
        {
          error: { message: "Duplicate file names in the same upload" },
          data: null,
        },
        { status: 400 },
      );
    }

    const visibility =
      parseVisibility(fields.visibility) ?? DEFAULT_FILE_VISIBILITY;

    let targetFolder: Folder;
    try {
      targetFolder = await createNestedFolders(fields.folder ?? "");
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            message: error instanceof Error ? error.message : "Invalid folder",
          },
          data: null,
        },
        { status: 400 },
      );
    }

    const pending = staged.map((file) => ({
      ...file,
      key: joinKey(targetFolder.key, file.originalName),
    }));

    for (const file of pending) {
      const conflict = db
        .select({ id: filesTable.id })
        .from(filesTable)
        .where(eq(filesTable.key, file.key))
        .get();

      if (conflict || (await accessPath(toStoragePath(file.key)))) {
        return NextResponse.json(
          {
            error: {
              message: `A file named "${file.originalName}" already exists in this folder`,
            },
            data: null,
          },
          { status: 409 },
        );
      }
    }

    let insertedFiles: FileDB[] = [];

    try {
      for (const file of pending) {
        const destination = toStoragePath(file.key);
        await fs.rename(file.stagedPath, destination);
        committedPaths.push(destination);
      }

      // return the inserted rows so the response carries the DB-generated
      // createdAt/updatedAt timestamps
      insertedFiles = db.transaction((tx) =>
        pending.map((file) =>
          tx
            .insert(filesTable)
            .values({
              id: crypto.randomUUID(),
              name: file.originalName,
              key: file.key,
              folderId: targetFolder.id,
              mimeType:
                mime.lookup(file.originalName) || "application/octet-stream",
              size: file.size,
              visibility,
            })
            .returning()
            .get(),
        ),
      );
    } catch (error) {
      console.error("File commit or DB transaction error:", error);
      // roll back only the files this request moved into place
      for (const filePath of committedPaths) {
        await fs.rm(filePath, { force: true }).catch(() => {});
      }

      return NextResponse.json(
        {
          data: null,
          error: {
            message:
              "Error uploading files. Partial uploads were safely reverted.",
          },
        },
        { status: 500 },
      );
    }

    revalidateDashboard();
    return NextResponse.json({
      data: { files: getFilesWithUrls(insertedFiles) },
      error: null,
    });
  } catch (error) {
    console.error("upload file error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const body: { id: string; name?: string; visibility?: string } =
      await request.json();
    const { id, name } = body;

    const visibility =
      body.visibility === undefined ? null : parseVisibility(body.visibility);

    if (body.visibility !== undefined && !visibility) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid visibility" } },
        { status: 400 },
      );
    }

    if (name === undefined && !visibility) {
      return NextResponse.json(
        { data: null, error: { message: "Nothing to update" } },
        { status: 400 },
      );
    }

    if (name !== undefined && !isValidName(name)) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid file name" } },
        { status: 400 },
      );
    }

    const file = db.select().from(filesTable).where(eq(filesTable.id, id)).get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const currentPath = toStoragePath(file.key);
    if (!(await accessPath(currentPath))) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // a visibility-only change never touches the filesystem
    if (name === undefined || file.name === name) {
      if (visibility) {
        db.update(filesTable)
          .set({ visibility, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(filesTable.id, id))
          .run();
        revalidateDashboard();
      }

      return NextResponse.json({ data: null, error: null });
    }

    const newKey = joinKey(parentKeyOf(file.key), name);

    // names are unique per folder, so the conflict check is scoped to the
    // folder — the same name in a different folder is fine
    const existingFile = db
      .select({ id: filesTable.id })
      .from(filesTable)
      .where(and(eq(filesTable.key, newKey), ne(filesTable.id, id)))
      .get();

    if (existingFile) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `A file named "${name}" already exists in this folder`,
          },
        },
        { status: 409 },
      );
    }

    const newPath = toStoragePath(newKey);

    let renamed = false;
    try {
      // rename on disk first, then update the DB; if the DB write fails we
      // roll the disk change back so the two never diverge.
      await fs.rename(currentPath, newPath);
      renamed = true;

      db.update(filesTable)
        .set({
          name,
          key: newKey,
          mimeType: mime.lookup(name) || "application/octet-stream",
          ...(visibility ? { visibility } : {}),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(filesTable.id, id))
        .run();
    } catch (error) {
      console.error("update file error", error);
      if (renamed) {
        await fs.rename(newPath, currentPath).catch(() => {});
      }
      return NextResponse.json(
        { data: null, error: { message: "Error updating file" } },
        { status: 500 },
      );
    }

    revalidateDashboard();
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("update file error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const { id }: { id: string } = await request.json();

    const file = db.select().from(filesTable).where(eq(filesTable.id, id)).get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // `force` makes an already-missing file a no-op, so a row orphaned by an
    // out-of-band delete still gets cleaned up instead of 404ing forever.
    try {
      await fs.rm(toStoragePath(file.key), { force: true });
      db.delete(filesTable).where(eq(filesTable.id, id)).run();
    } catch (error) {
      console.error("delete file error", error);
      return NextResponse.json(
        { error: { message: "Error deleting file" }, data: null },
        { status: 500 },
      );
    }

    revalidateDashboard();
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("delete file error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
