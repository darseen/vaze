import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";

type FileMetadata = {
  id: string;
  bucket: string;
  fileName: string;
  size: number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bucket: string[] }> },
) {
  const { bucket } = await params;
  const formData = await request.formData();
  const bucketPath = path.join(BASE_UPLOADS_PATH, ...bucket);
  const uploadedFiles: FileMetadata[] = [];

  const files = formData.getAll("files") as File[] | null;
  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files found" }, { status: 400 });
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
      }-${crypto.randomUUID()}${path.extname(file.name)}`;

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
        `INSERT INTO files (id, file_name, bucket, size) VALUES (?, ?, ?, ?)`,
      );
      for (const f of filesToInsert) {
        insertStatement.run(f.id, f.fileName, f.bucket, f.size);
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

  return NextResponse.json({ data: { files: uploadedFiles }, error: null });
}
