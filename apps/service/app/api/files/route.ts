import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import type { File as FileDB, Folder } from "@repo/types";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  accessPath,
  createNestedFolders,
  fileOrderBy,
  getFilesWithUrls,
  isValidName,
  OrderBy,
  OrderDirection,
  parseIntParam,
} from "../_utils";
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
    const name = searchParams.get("name");
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

    if (id) {
      const file = db
        .select()
        .from(filesTable)
        .where(eq(filesTable.id, id))
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
    } else if (name) {
      const files = db
        .select()
        .from(filesTable)
        .where(eq(filesTable.name, name))
        .orderBy(fileOrderBy(safeOrderBy, safeOrderDirection))
        .limit(limit)
        .offset(offset)
        .all();

      // zero matches is a valid search result, not an error
      return NextResponse.json({
        data: { files: getFilesWithUrls(files) },
        error: null,
      });
    }

    const files = db
      .select()
      .from(filesTable)
      .orderBy(fileOrderBy(safeOrderBy, safeOrderDirection))
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({
      data: { files: getFilesWithUrls(files) },
      error: null,
    });
  } catch (error) {
    console.log("get files error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const folder = (formData.get("folder") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: { message: "Missing required fields" }, data: null },
        { status: 400 },
      );
    }

    let targetFolder: Folder;
    try {
      targetFolder = await createNestedFolders(folder);
    } catch (err: any) {
      return NextResponse.json(
        { error: { message: err.message }, data: null },
        { status: 400 },
      );
    }

    const uploadedFiles: Omit<FileDB, "createdAt" | "updatedAt">[] = [];
    const filesWrittenToDisk: string[] = []; // track paths for targeted cleanup
    let insertedFiles: FileDB[] = [];

    try {
      for (const file of files) {
        const fileName = `${
          path.parse(file.name).name
        }-${crypto.randomUUID().split("-")[0]}${path.extname(file.name)}`;

        const fileType = path.extname(fileName);
        const fileAbsolutePath = path.join(targetFolder.path, fileName);

        filesWrittenToDisk.push(fileAbsolutePath);

        const nodeStream = Readable.fromWeb(file.stream() as any);
        // "wx" fails if the path already exists, so a suffix collision can
        // never silently truncate an existing file.
        const fileToWriteTo = await fs.open(fileAbsolutePath, "wx");
        await pipeline(nodeStream, fileToWriteTo.createWriteStream());

        uploadedFiles.push({
          id: crypto.randomUUID(),
          path: fileAbsolutePath,
          folderId: targetFolder.id,
          type: fileType,
          name: fileName,
          size: file.size,
        });
      }

      // return the inserted rows so the response carries the DB-generated
      // createdAt/updatedAt timestamps
      insertedFiles = db.transaction((tx) =>
        uploadedFiles.map((file) =>
          tx
            .insert(filesTable)
            .values({
              id: file.id,
              name: file.name,
              folderId: file.folderId,
              path: file.path,
              size: file.size,
              type: file.type,
            })
            .returning()
            .get(),
        ),
      );
    } catch (error) {
      console.error("File processing or DB transaction error:", error);
      // iterate through only the files this request touched
      for (const filePath of filesWrittenToDisk) {
        await fs.unlink(filePath).catch(() => {
          console.log(
            `Cleanup note: File ${filePath} was not fully written, skipped deletion.`,
          );
        });
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

    revalidatePath("/dashboard");
    return NextResponse.json({
      data: { files: getFilesWithUrls(insertedFiles) },
      error: null,
    });
  } catch (error) {
    console.log("upload file error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    const { id, name }: { id: string; name: string } = await request.json();

    if (!isValidName(name, { allowDots: true })) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid file name" } },
        { status: 400 },
      );
    }

    const file = db
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, id))
      .get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const fileExists = await accessPath(file.path);
    if (!fileExists) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // `files.name` is globally unique, so the conflict check must be global —
    // a per-folder check would let the UNIQUE constraint throw *after* the disk
    // rename, leaving the DB pointing at a stale path.
    const existingFile = db
      .select({ id: filesTable.id })
      .from(filesTable)
      .where(and(eq(filesTable.name, name), ne(filesTable.id, id)))
      .get();

    if (existingFile) {
      return NextResponse.json(
        { data: null, error: { message: "File name already exists" } },
        { status: 409 },
      );
    }

    const fileDirectory = path.dirname(file.path);
    const newAbsolutePath = path.join(fileDirectory, name);
    const newType = path.extname(name);

    let renamed = false;
    try {
      // rename on disk first, then update the DB; if the DB write fails we
      // roll the disk change back so the two never diverge.
      await fs.rename(file.path, newAbsolutePath);
      renamed = true;

      db.update(filesTable)
        .set({
          name,
          path: newAbsolutePath,
          type: newType,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(filesTable.id, id))
        .run();
    } catch (error) {
      console.log("update file error", error);
      if (renamed) {
        await fs.rename(newAbsolutePath, file.path).catch(() => {});
      }
      return NextResponse.json(
        { data: null, error: { message: "Error updating file" } },
        { status: 500 },
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.log("update file error", error);
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
        { status: 401 },
      );
    }

    const { id }: { id: string } = await request.json();

    // find in database
    const file = db
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, id))
      .get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // check if file exists on disk
    const fileExists = await accessPath(file.path);
    if (!fileExists) {
      // The file is already gone from disk; drop the orphaned row and treat the
      // delete as successful rather than surfacing a misleading 404.
      db.delete(filesTable).where(eq(filesTable.id, id)).run();
      revalidatePath("/dashboard");

      return NextResponse.json({ data: null, error: null });
    }

    // delete file from disk and database
    try {
      await fs.rm(file.path);
      db.delete(filesTable).where(eq(filesTable.id, id)).run();
    } catch {
      return NextResponse.json(
        { error: { message: "Error deleting file" }, data: null },
        { status: 500 },
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.log("delete file error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
