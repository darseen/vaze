import db from "@/db";
import { File as FileDB } from "@repo/types";
import mime from "mime-types";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
import { accessPathSync, contentDisposition } from "../../_utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    const file = db
      .prepare("SELECT * FROM files WHERE name = ?")
      .get(filename) as FileDB | undefined;

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (!accessPathSync(file.path)) {
      return NextResponse.json(
        { error: "File missing from local storage" },
        { status: 404 },
      );
    }

    const mimeType = mime.lookup(file.name) || "application/octet-stream";

    const nodeStream = fs.createReadStream(file.path);
    const webStream = Readable.toWeb(nodeStream);

    return new NextResponse(webStream as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition("inline", file.name),
        "Content-Length": file.size.toString(),
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
