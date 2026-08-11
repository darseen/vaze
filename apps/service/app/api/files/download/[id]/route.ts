import { contentDisposition, toStoragePath } from "@/app/api/_utils";
import { db } from "@/db";
import { streamFileResponse } from "@/lib/http-cache";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";
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

    // size and mtime come from the file itself — a drifted `size` column would
    // truncate or hang the response
    let stats: Stats;
    try {
      stats = await stat(storagePath);
    } catch {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    // streamed, range-aware and revalidatable, so an interrupted download can
    // be resumed instead of restarted
    return streamFileResponse({
      request,
      path: storagePath,
      stats,
      cacheable: true,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": contentDisposition("attachment", file.name),
        "Cache-Control": "private, max-age=0, must-revalidate",
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
