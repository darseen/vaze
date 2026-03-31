import db from "@/db";
import type { File as FileDB, Folder } from "@repo/types";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { accessPath, createNestedFolders, getFilesWithUrls } from "../_utils";
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
    const limit = parseInt(searchParams.get("limit") || "-1");
    const offset = parseInt(searchParams.get("offset") || "0");
    const orderBy = searchParams.get("orderBy") || "created_at";
    const orderDirection = searchParams.get("orderDirection") || "DESC";

    const safeOrderBy = ["created_at", "updated_at", "name", "size"].includes(
      orderBy,
    )
      ? orderBy
      : "created_at";
    const safeOrderDirection = ["ASC", "DESC"].includes(
      orderDirection.toUpperCase(),
    )
      ? orderDirection
      : "DESC";

    if (id) {
      const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as
        | FileDB
        | undefined;

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
        .prepare(
          `SELECT * FROM files WHERE name = ? ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
        )
        .all(name, limit, offset) as FileDB[];

      if (!files || files.length === 0) {
        return NextResponse.json(
          { data: null, error: { message: "File not found" } },
          { status: 404 },
        );
      }
      console.log(files);
      return NextResponse.json({
        data: { files: getFilesWithUrls(files)[0] },
        error: null,
      });
    }

    const files = db
      .prepare(
        `SELECT * FROM files ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as FileDB[];

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

    const uploadedFiles: Omit<FileDB, "created_at" | "updated_at">[] = [];
    const filesWrittenToDisk: string[] = []; // track paths for targeted cleanup

    try {
      for (const file of files) {
        const fileName = `${
          path.parse(file.name).name
        }-${crypto.randomUUID().split("-")[0]}${path.extname(file.name)}`;

        const fileType = path.extname(fileName);
        const fileAbsolutePath = path.join(targetFolder.path, fileName);

        filesWrittenToDisk.push(fileAbsolutePath);

        const nodeStream = Readable.fromWeb(file.stream() as any);
        const fileToWriteTo = await fs.open(fileAbsolutePath, "w");
        await pipeline(nodeStream, fileToWriteTo.createWriteStream());

        uploadedFiles.push({
          id: crypto.randomUUID(),
          path: fileAbsolutePath,
          folder_id: targetFolder.id,
          type: fileType,
          name: fileName,
          size: file.size,
        });
      }

      const insertMany = db.transaction(
        (filesToInsert: Omit<FileDB, "created_at" | "updated_at">[]) => {
          const insertStatement = db.prepare(
            `INSERT INTO files (id, name, folder_id, path, size, type) VALUES (?, ?, ?, ?, ?, ?)`,
          );
          for (const file of filesToInsert) {
            insertStatement.run(
              file.id,
              file.name,
              file.folder_id,
              file.path,
              file.size,
              file.type,
            );
          }
        },
      );
      insertMany(uploadedFiles);
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
      data: { files: getFilesWithUrls(uploadedFiles as FileDB[]) },
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

    const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as
      | FileDB
      | undefined;

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

    // check if file name already exists in the same folder
    const existingFile = db
      .prepare(`SELECT * FROM files WHERE name = ? AND folder_id = ?`)
      .get(name, file.folder_id) as FileDB | undefined;

    if (existingFile) {
      return NextResponse.json(
        { data: null, error: { message: "File name already exists" } },
        { status: 409 },
      );
    }

    try {
      const fileDirectory = path.dirname(file.path);
      const newAbsolutePath = path.join(fileDirectory, name);

      // update file name on disk
      await fs.rename(file.path, newAbsolutePath);

      db.prepare(`UPDATE files SET name = ?, path = ? WHERE id = ?`).run(
        name,
        newAbsolutePath,
        id,
      );
    } catch (error) {
      console.log("update file error", error);
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
    const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as
      | FileDB
      | undefined;

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // check if file exists on disk
    const fileExists = await accessPath(file.path);
    if (!fileExists) {
      // delete file from database if it doesn't exist on disk
      db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
      revalidatePath("/dashboard");

      return NextResponse.json(
        { error: { message: "File not found" }, data: null },
        { status: 404 },
      );
    }

    // delete file from disk and database
    try {
      await fs.rm(file.path);
      db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
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
