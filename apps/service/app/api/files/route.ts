import { BASE_UPLOADS_PATH } from "@/constants";
import db, { File as FileDB } from "@/db";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
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

    // fetch all files from the database
    const files = db
      .prepare("SELECT * FROM files ORDER BY created_at DESC")
      .all() as FileDB[];

    return NextResponse.json({ data: { files }, error: null });
  } catch (error) {
    console.log("get files error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

type FileMetadata = {
  id: string;
  bucket: string;
  fileName: string;
  size: number;
};

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
    const bucket = formData.get("bucket") as string;
    const bucketPath = path.join(BASE_UPLOADS_PATH, bucket);
    const uploadedFiles: FileMetadata[] = [];

    const files = formData.getAll("files") as File[] | null;
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: { message: "No files found" }, data: null },
        { status: 400 },
      );
    }

    // create bucket if it doesn't exist
    try {
      await fs.access(bucketPath, fs.constants.F_OK);
    } catch {
      await fs.mkdir(bucketPath, { recursive: true });
    }

    try {
      for (const file of files) {
        // attach random uuid to file name
        const fileName = `${
          path.parse(file.name).name
        }-${crypto.randomUUID().split("-")[0]}${path.extname(file.name)}`;

        // construct file path
        const filePath = path.join(bucketPath, fileName);

        // create a readable stream from the file
        const fileStream = file.stream();

        // write file to disk
        const fileToWriteTo = await fs.open(filePath, "w");
        // @ts-expect-error - type issue
        await pipeline(fileStream, fileToWriteTo.createWriteStream());

        uploadedFiles.push({
          id: crypto.randomUUID(),
          bucket: path.join(...bucket),
          fileName,
          size: file.size,
        });
      }

      // run all database inserts within a single, atomic transaction
      const insertMany = db.transaction((filesToInsert: FileMetadata[]) => {
        const insertStatement = db.prepare(
          `INSERT INTO files (id, name, bucket, size) VALUES (?, ?, ?, ?)`,
        );
        for (const f of filesToInsert) {
          insertStatement.run(
            f.id,
            f.fileName,
            f.bucket.replace("\\", "/"),
            f.size,
          );
        }
      });
      insertMany(uploadedFiles); // this is atomic. It all succeeds or all fails.
    } catch {
      // revert the changes if there is an error
      for (const file of uploadedFiles) {
        await fs
          .rm(path.join(BASE_UPLOADS_PATH, file.bucket, file.fileName))
          .catch();
      }
      // delete the folder if it's empty
      const files = await fs.readdir(bucketPath);
      if (files.length === 0) {
        await fs.rmdir(bucketPath).catch();
      }

      return NextResponse.json(
        { data: null, error: { message: "Error uploading file" } },
        { status: 400 },
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: { files: uploadedFiles }, error: null });
  } catch (error) {
    console.log("upload file error", error);
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

    const { name, bucket }: { name: string; bucket: string } =
      await request.json();
    const bucketPath = path.join(BASE_UPLOADS_PATH, bucket);
    const filePath = path.join(bucketPath, name);

    // check if file exists on disk
    try {
      await fs.access(filePath, fs.constants.F_OK);
    } catch {
      // delete file from database if it doesn't exist on disk
      const statement = db.prepare(
        `DELETE FROM files WHERE name = ? AND bucket = ?`,
      );
      statement.run(name, bucket);
      revalidatePath("/dashboard");

      return NextResponse.json(
        { error: { message: "File not found" }, data: null },
        { status: 404 },
      );
    }

    // delete file from disk and database
    try {
      await fs.rm(path.join(filePath));
      const statement = db.prepare(
        `DELETE FROM files WHERE name = ? AND bucket = ?`,
      );
      statement.run(name, bucket);
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
