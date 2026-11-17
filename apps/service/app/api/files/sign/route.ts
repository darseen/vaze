import { normalizeKey } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { db } from "@/db";
import { parseImageTransform } from "@/lib/image-transform";
import { buildSignedUrl } from "@/lib/presign";
import { isConvertibleImage } from "@/utils/conversion";
import { files as filesTable } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:read",
    });
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
      width,
      format,
    }: {
      id?: string;
      key?: string;
      expiresIn?: number;
      width?: unknown;
      format?: unknown;
    } = await request.json();

    if (!id && !key) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id or key" } },
        { status: 400 },
      );
    }

    // the signature covers the resize, so the link can't be edited to another size
    const { transform, error: transformError } = parseImageTransform({
      width,
      format,
    });
    if (transformError) {
      return NextResponse.json(
        { data: null, error: { message: transformError } },
        { status: 400 },
      );
    }

    const file = db
      .select()
      .from(filesTable)
      .where(
        and(
          id ? eq(filesTable.id, id) : eq(filesTable.key, normalizeKey(key)),
          isNull(filesTable.deletedAt),
        ),
      )
      .get();

    if (!file) {
      return NextResponse.json(
        { data: null, error: { message: "File not found" } },
        { status: 404 },
      );
    }

    if (transform && !isConvertibleImage(file)) {
      return NextResponse.json(
        {
          data: null,
          error: { message: "Only images can be resized or converted" },
        },
        { status: 400 },
      );
    }

    const ttl =
      typeof expiresIn === "number" && Number.isFinite(expiresIn)
        ? expiresIn
        : undefined;

    // signing a public file is allowed — the link simply also works unsigned
    const { url, expiresAt } = buildSignedUrl(file.key, ttl, transform);

    return NextResponse.json({ data: { url, expiresAt }, error: null });
  } catch (error) {
    console.error("sign file error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
