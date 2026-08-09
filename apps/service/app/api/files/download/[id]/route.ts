import { contentDisposition, toStoragePath } from "@/app/api/_utils";
import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { stat } from "node:fs/promises";
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
        { status: authError.status },
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id" } },
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

    const storagePath = toStoragePath(file.key);

    // size comes from the file itself — a drifted `size` column would truncate
    // or hang the response
    let size: number;
    try {
      ({ size } = await stat(storagePath));
    } catch {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // stream the file rather than buffering the whole thing into memory
    const nodeStream = fs.createReadStream(storagePath);
    const webStream = Readable.toWeb(nodeStream);

    return new NextResponse(webStream as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": contentDisposition("attachment", file.name),
        "Content-Length": size.toString(),
        "X-Content-Type-Options": "nosniff",
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
