import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
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
    const { filename: rawFilename } = await params;
    // the route param arrives percent-encoded (hosting URLs are built with
    // encodeURIComponent), so decode it before the DB lookup
    const filename = decodeURIComponent(rawFilename);

    const file = db
      .select()
      .from(filesTable)
      .where(eq(filesTable.name, filename))
      .get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    if (!accessPathSync(file.path)) {
      return NextResponse.json(
        { data: null, error: { message: "File missing from local storage" } },
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
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
