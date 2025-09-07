import { BASE_UPLOADS_PATH } from "@/constants";
import db, { File } from "@/db";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import authorizeRequest from "../../../_utils/authorize-request";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: 401 },
      );
    }

    let { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id" } },
        { status: 400 },
      );
    }

    // find in database
    const file = db.prepare(`SELECT * FROM files WHERE id = ?`).get(id) as
      | File
      | undefined;

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const filePath = path.join(BASE_UPLOADS_PATH, file.folder, file.name);

    // check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // read file from disk
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    // convert Buffer to Uint8Array
    const fileArray = new Uint8Array(fileBuffer);

    // get filename
    const filename = path.basename(filePath);

    // get MIME type
    const mimeType = getMimeType(filename);

    // return the file with appropriate headers
    return new NextResponse(fileArray, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stats.size.toString(),
      },
    });
  } catch (error) {
    console.error("error downloading file:", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
