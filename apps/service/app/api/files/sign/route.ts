import { normalizeKey } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { DEFAULT_PRESIGN_TTL_SECONDS } from "@/constants";
import { db } from "@/db";
import { buildSignedUrl } from "@/lib/presign";
import { files as filesTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    const {
      id,
      key,
      expiresIn,
    }: { id?: string; key?: string; expiresIn?: number } = await request.json();

    if (!id && !key) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id or key" } },
        { status: 400 },
      );
    }

    const file = db
      .select()
      .from(filesTable)
      .where(id ? eq(filesTable.id, id) : eq(filesTable.key, normalizeKey(key)))
      .get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    const ttl =
      typeof expiresIn === "number" && Number.isFinite(expiresIn)
        ? expiresIn
        : DEFAULT_PRESIGN_TTL_SECONDS;

    // signing a public file is allowed — the link simply also works unsigned
    const { url, expiresAt } = buildSignedUrl(file.key, ttl);

    return NextResponse.json({ data: { url, expiresAt }, error: null });
  } catch (error) {
    console.error("sign file error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
