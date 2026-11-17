import { db } from "@/db";
import { ConversionError } from "@/lib/conversion";
import { findCachedImage, renderImage, variantName } from "@/lib/hosted-images";
import { countBytes, countNotFound, countServed } from "@/lib/hosting-traffic";
import { streamFileResponse } from "@/lib/http-cache";
import {
  outputFormat,
  parseImageTransform,
  type ImageTransform,
} from "@/lib/image-transform";
import { verifySignature } from "@/lib/presign";
import { getLimits } from "@/lib/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  IMAGE_FORMAT_INFO,
  isConvertibleImage,
  toImageName,
} from "@/utils/conversion";
import { files as filesTable, type File } from "@repo/db";
import { getSessionCookie } from "better-auth/cookies";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";
import { contentDisposition, isValidKey, toStoragePath } from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";

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

function jsonError(message: string, status: number, retryAfter?: number) {
  return NextResponse.json(
    { data: null, error: { message } },
    {
      status,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );
}

const notFound = () => jsonError("File not found", 404);

/**
 * Traffic counts what visitors and other apps pull. A request carrying a
 * dashboard or app session is the owner browsing, and HEAD sends no body.
 */
function isTracked(request: NextRequest): boolean {
  return request.method === "GET" && !getSessionCookie(request);
}

/**
 * The signature is pure CPU while `authorizeRequest` costs a DB round trip, so
 * it is checked first — anonymous traffic on this path never hits the database.
 */
async function canReadPrivate(
  request: NextRequest,
  key: string,
  transform: ImageTransform | null,
): Promise<boolean> {
  const params = request.nextUrl.searchParams;

  if (verifySignature(key, params.get("exp"), params.get("sig"), transform)) {
    return true;
  }

  const { error } = await authorizeRequest(request, { scope: "files:read" });
  return !error;
}

/** What a response sends: the file itself, or a copy of it. */
interface Body {
  path: string;
  stats: Stats;
  mimeType: string;
  name: string;
  /** Names a resized or converted copy, whose ETag it marks. */
  variant?: string;
}

/** The copy a transform asks for, rendered first when it isn't cached, or the error to send. */
async function imageCopy(
  request: NextRequest,
  file: File,
  storagePath: string,
  transform: ImageTransform,
): Promise<Body | NextResponse> {
  if (!isConvertibleImage(file)) {
    return jsonError("Only images can be resized or converted", 400);
  }

  const variant = {
    width: transform.width,
    format: outputFormat(transform, file.mimeType),
  };

  let copy = await findCachedImage(file.id, variant);
  if (!copy) {
    // rendering costs seconds of CPU where a cached copy costs one read
    const renders = rateLimit("hosting-render", clientIp(request), {
      limit: 60,
      windowMs: 60_000,
    });
    if (!renders.ok) {
      return jsonError("Too many requests", 429, renders.retryAfter);
    }

    try {
      copy = await renderImage(file.id, storagePath, variant);
    } catch (error) {
      if (!(error instanceof ConversionError)) throw error;
      const retryAfter = error.status === 503 ? 10 : undefined;
      return jsonError(error.message, error.status, retryAfter);
    }
  }

  return {
    path: copy.path,
    stats: copy.stats,
    mimeType: IMAGE_FORMAT_INFO[variant.format].mimeType,
    name: toImageName(file.name, variant.format),
    variant: variantName(variant),
  };
}

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

    if (!limit.ok) return jsonError("Too many requests", 429, limit.retryAfter);

    const searchParams = request.nextUrl.searchParams;

    // checked before the lookup, so a bad size says nothing about the key
    const { transform, error: transformError } = parseImageTransform({
      width: searchParams.get("w"),
      format: searchParams.get("format"),
      widthName: "w",
    });
    if (transformError) return jsonError(transformError, 400);

    const tracked = isTracked(request);
    const missing = () => {
      if (tracked) countNotFound();
      return notFound();
    };

    const { key: segments } = await params;

    // route params arrive percent-encoded (hosting URLs encode each segment);
    // a malformed encoding is a bad key, not a server error
    let key: string;
    try {
      key = segments.map((segment) => decodeURIComponent(segment)).join("/");
    } catch {
      return missing();
    }

    if (!isValidKey(key) || key === "") return missing();

    const file = db
      .select()
      .from(filesTable)
      .where(and(eq(filesTable.key, key), isNull(filesTable.deletedAt)))
      .get();

    if (!file) return missing();

    // A private file that the caller cannot read is reported as missing, not
    // forbidden — a 403 would confirm the key exists and turn this into an
    // enumeration oracle.
    if (
      file.visibility === "private" &&
      !(await canReadPrivate(request, key, transform))
    ) {
      return missing();
    }

    const storagePath = toStoragePath(file.key);

    // size and mtime come from the file itself — a drifted `size` column would
    // truncate or hang the response
    let stats: Stats;
    try {
      stats = await stat(storagePath);
    } catch {
      if (tracked) countNotFound();
      return jsonError("File missing from local storage", 404);
    }

    let body: Body = {
      path: storagePath,
      stats,
      mimeType: file.mimeType,
      name: file.name,
    };

    if (transform) {
      const copy = await imageCopy(request, file, storagePath, transform);
      if (copy instanceof Response) return copy;
      body = copy;
    }

    const disposition =
      searchParams.get("download") === "1" ? "attachment" : "inline";

    const isPrivate = file.visibility === "private";

    const response = streamFileResponse({
      request,
      path: body.path,
      stats: body.stats,
      variant: body.variant,
      onBytes: tracked ? (bytes) => countBytes(file.id, bytes) : undefined,
      // a private object must not be retained by a proxy or CDN in front of
      // Vaze and handed to the next caller
      cacheable: !isPrivate,
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": body.mimeType,
        "Content-Disposition": contentDisposition(disposition, body.name),
        "Cache-Control": isPrivate
          ? "private, no-store"
          : `public, max-age=${getLimits().hostingCacheMaxAge}, must-revalidate`,
      },
    });

    // a 416 served nothing, so only 200, 206 and 304 count
    if (tracked && [200, 206, 304].includes(response.status)) {
      countServed(file.id);
    }

    return response;
  } catch (error) {
    console.error("Error serving file:", error);
    return jsonError("Internal server error", 500);
  }
}
