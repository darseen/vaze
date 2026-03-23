import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { File as FileDB, Folder } from "@repo/types";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { accessPath } from "../_utils";
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
  folderId: string;
  path: string;
  type: string;
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
    const folder = formData.get("folder") as string | null;
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: { message: "Missing required fields" }, data: null },
        { status: 400 },
      );
    }

    // check if folder contains any dots
    if (folder && folder.includes(".")) {
      return NextResponse.json(
        { error: { message: "Folder name cannot contain dots" }, data: null },
        { status: 400 },
      );
    }

    const folderName = path.basename(folder ? folder : "uploads");
    const folderAbsolutePath = path.join(
      BASE_UPLOADS_PATH,
      // remove leading slash if folder is provided
      folder ? folder.replace("/", "") : "",
    );
    const uploadedFiles: FileMetadata[] = [];

    // create folder if it doesn't exist
    const folderExists = await accessPath(folderAbsolutePath);
    if (!folderExists) {
      await fs.mkdir(folderAbsolutePath, { recursive: true });
    }

    try {
      for (const file of files) {
        // attach random uuid to file name
        const fileName = `${
          path.parse(file.name).name
        }-${crypto.randomUUID().split("-")[0]}${path.extname(file.name)}`;

        // get file type
        const fileType = path.extname(fileName);

        // construct file path
        const fileAbsolutePath = path.join(folderAbsolutePath, fileName);

        // create a readable stream from the file
        const fileStream = file.stream();

        // write file to disk
        const fileToWriteTo = await fs.open(fileAbsolutePath, "w");
        // @ts-expect-error - type issue
        await pipeline(fileStream, fileToWriteTo.createWriteStream());

        // get folder id from database
        let folderInDB = db
          .prepare(`SELECT * FROM folders WHERE path = ?`)
          .get(folderAbsolutePath) as Folder | undefined;

        // create folder if it doesn't exist
        if (!folderInDB) {
          try {
            db.prepare(
              `INSERT INTO folders (id, name, path, type) VALUES (?, ?, ?, ?)`,
            ).run(
              crypto.randomUUID(),
              folderName,
              folderAbsolutePath,
              fileType,
            );

            folderInDB = db
              .prepare(`SELECT * FROM folders WHERE path = ?`)
              .get(folderAbsolutePath) as Folder;
          } catch (error) {
            console.log(error);
            // revert the changes if there is an error
            await fs
              .rm(folderAbsolutePath, { recursive: true, force: true })
              .catch();
            db.prepare(`DELETE FROM folders WHERE path = ?`).run(
              folderAbsolutePath,
            );

            return NextResponse.json(
              { data: null, error: { message: "Error creating folder" } },
              { status: 400 },
            );
          }
        }

        uploadedFiles.push({
          id: crypto.randomUUID(),
          path: fileAbsolutePath,
          folderId: folderInDB.id,
          type: fileType,
          fileName,
          size: file.size,
        });
      }

      // run all database inserts within a single, atomic transaction
      const insertMany = db.transaction((filesToInsert: FileMetadata[]) => {
        const insertStatement = db.prepare(
          `INSERT INTO files (id, name, folder_id, path, size, type) VALUES (?, ?, ?, ?, ?, ?)`,
        );
        for (const file of filesToInsert) {
          insertStatement.run(
            file.id,
            file.fileName,
            file.folderId,
            file.path,
            file.size,
            file.type,
          );
        }
      });
      insertMany(uploadedFiles);
    } catch (error) {
      console.log(error);
      // revert the changes if there is an error
      await fs.rm(folderAbsolutePath, { recursive: true, force: true }).catch();
      db.prepare(`DELETE FROM folders WHERE path = ?`).run(folderAbsolutePath); // files would be deleted by cascade

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

    const fileExists = await accessPath(file.path);
    if (!fileExists) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    try {
      // update file name on disk
      await fs.rename(file.path, path.join(BASE_UPLOADS_PATH, name));
      // update file name in database
      db.prepare(`UPDATE files SET name = ? WHERE id = ?`).run(name, id);
    } catch {
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
