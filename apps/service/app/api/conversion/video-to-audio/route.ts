import { BASE_TMP_PATH } from "@/constants";
import {
  acquireSlot,
  ConversionError,
  convertToMp3,
  isBusy,
} from "@/lib/conversion";
import { toMp3Name } from "@/utils/conversion";
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
 * Converts a video to MP3 and streams it back. The body is either JSON
 * `{ fileId }` for a stored file, or multipart with one `file` for a file from
 * the caller's device, which is staged only until the conversion ends.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await authorizeRequest(request, {
    scope: "files:read",
    bucket: "conversion",
    limit: 30,
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  // refuse before a device upload is read, not after
  if (isBusy()) return busy();

  let stagingDir: string | null = null;
  let release: (() => void) | null = null;
  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    release?.();
    if (stagingDir) {
      fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    }
  };

  try {
    let source: ConversionSource;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      stagingDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
      ({ source } = await receiveUpload(request, stagingDir));
    } else {
      const body = await request.json().catch(() => null);
      source = await findStoredFile(body?.fileId);
    }

    release = acquireSlot();
    if (!release) {
      cleanUp();
      return busy();
    }

    const { stream, duration } = await convertToMp3(
      source.path,
      request.signal,
      cleanUp,
    );

    const headers = new Headers({
      "Content-Type": "audio/mpeg",
      "Content-Disposition": contentDisposition(
        "attachment",
        toMp3Name(source.name),
      ),
      "Cache-Control": "no-store",
    });
    // lets the dashboard show real progress against the expected size
    if (duration) headers.set("X-Content-Duration", duration.toFixed(3));

    return new Response(stream, { headers });
  } catch (error) {
    cleanUp();

    if (error instanceof ConversionError) {
      return jsonError(error.message, error.status);
    }
    if (request.signal.aborted || isClientAbort(error)) {
      return new NextResponse(null, { status: 499 });
    }

    console.error("video to audio conversion error", error);
    return jsonError("Failed to convert file", 500);
  }
}
