import { BASE_TMP_PATH } from "@/constants";
import { ConversionError } from "@/lib/conversion";
import {
  acquireTurn,
  convertImage,
  isBusy,
  parseImageOptions,
  type ImageOptions,
} from "@/lib/image-conversion";
import { IMAGE_FORMAT_INFO, toImageName } from "@/utils/conversion";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { contentDisposition } from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";
import {
  busy,
  findStoredFile,
  jsonError,
  receiveUpload,
  type ConversionSource,
} from "../../_utils/conversion";
import { isClientAbort } from "../../_utils/multipart";

/**
 * Converts an image to WebP, JPG, PNG or AVIF and sends it back. The body is
 * either JSON `{ fileId, format, quality?, width?, height? }` for a stored
 * file, or multipart with one `file` and the options as fields for a file
 * from the caller's device, which is staged only until the conversion ends.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await authorizeRequest(request, {
    scope: "files:read",
    bucket: "image-conversion",
    limit: 60,
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  // refuse before a device upload is read, not after
  if (isBusy()) return busy();

  // holds a device upload and a decoded HEIC until the conversion ends
  const workDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
  let release: (() => void) | null = null;

  try {
    let source: ConversionSource;
    let options: ImageOptions;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const upload = await receiveUpload(request, workDir);
      source = upload.source;
      options = parseImageOptions(upload.fields);
    } else {
      const body: unknown = await request.json().catch(() => null);
      const fields = (body && typeof body === "object" ? body : {}) as Record<
        string,
        unknown
      >;
      options = parseImageOptions(fields);
      source = await findStoredFile(fields.fileId);
    }

    release = await acquireTurn(request.signal);
    if (!release) return busy();

    const { data, width, height } = await convertImage(source.path, options, {
      signal: request.signal,
      workDir,
    });

    // sharp's buffer owns a plain ArrayBuffer, never a shared one
    return new Response(data as Uint8Array<ArrayBuffer>, {
      headers: {
        "Content-Type": IMAGE_FORMAT_INFO[options.format].mimeType,
        "Content-Length": String(data.length),
        "Content-Disposition": contentDisposition(
          "attachment",
          toImageName(source.name, options.format),
        ),
        "Cache-Control": "no-store",
        "X-Image-Width": String(width),
        "X-Image-Height": String(height),
      },
    });
  } catch (error) {
    if (error instanceof ConversionError) {
      return jsonError(error.message, error.status);
    }
    if (request.signal.aborted || isClientAbort(error)) {
      return new NextResponse(null, { status: 499 });
    }

    console.error("image conversion error", error);
    return jsonError("Failed to convert file", 500);
  } finally {
    release?.();
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
