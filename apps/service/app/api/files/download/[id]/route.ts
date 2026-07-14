import { accessPathSync, contentDisposition } from "@/app/api/_utils";
import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
import mime from "mime-types";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { Readable } from "node:stream";
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id" } },
        { status: 400 },
      );
    }

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

    // check if file exists
    if (!accessPathSync(file.path)) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const mimeType = mime.lookup(file.name) || "application/octet-stream";

    // stream the file rather than buffering the whole thing into memory
    const nodeStream = fs.createReadStream(file.path);
    const webStream = Readable.toWeb(nodeStream);

    return new NextResponse(webStream as ReadableStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition("attachment", file.name),
        "Content-Length": file.size.toString(),
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
