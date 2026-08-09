import { db } from "@/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentDisposition, isValidKey, toStoragePath } from "../../_utils";

// Hosted content is untrusted and served from the dashboard's own origin, so it
// must never be able to run as this origin: `sandbox` drops it into an opaque
// origin with scripts disabled (HTML and SVG still render, inert), and
// `nosniff` pins the declared type. CORP keeps embedding from other sites working.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Access-Control-Allow-Origin": "*",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    // this route is public, so it is the most exposed surface on the instance
    const limit = rateLimit("hosting", clientIp(request), {
      limit: 600,
      windowMs: 60_000,
    });

    if (!limit.ok) {
      return NextResponse.json(
        { data: null, error: { message: "Too many requests" } },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { key: segments } = await params;

    // route params arrive percent-encoded (hosting URLs encode each segment);
    // a malformed encoding is a bad key, not a server error
    let key: string;
    try {
      key = segments.map((segment) => decodeURIComponent(segment)).join("/");
    } catch {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    if (!isValidKey(key) || key === "") {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const file = db
      .select()
      .from(filesTable)
      .where(eq(filesTable.key, key))
      .get();

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
        { data: null, error: { message: "File missing from local storage" } },
        { status: 404 },
      );
    }

    const nodeStream = fs.createReadStream(storagePath);
    const webStream = Readable.toWeb(nodeStream);

    return new NextResponse(webStream as ReadableStream, {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": file.mimeType,
        "Content-Disposition": contentDisposition("inline", file.name),
        "Content-Length": size.toString(),
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
