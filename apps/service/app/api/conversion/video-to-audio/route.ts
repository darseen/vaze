import { BASE_DATA_PATH, BASE_TMP_PATH } from "@/constants";
import { db } from "@/db";
import {
  acquireSlot,
  ConversionError,
  convertToMp3,
  isBusy,
} from "@/lib/conversion";
import { getLimits } from "@/lib/settings";
import { toMp3Name } from "@/utils/conversion";
import { getAvailableStorage } from "@/utils/storage";
import { files as filesTable } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { accessPath, contentDisposition, toStoragePath } from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";
import {
  isClientAbort,
  parseMultipartToDisk,
  TooManyFilesError,
  UploadTooLargeError,
} from "../../_utils/multipart";

const jsonError = (message: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error: { message }, data: null }, { status, headers });

const busy = () =>
  jsonError("The server is busy converting other files, try again soon", 503, {
    "Retry-After": "10",
  });

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
    return jsonError(
      authError.message,
      authError.status,
      authError.retryAfter
        ? { "Retry-After": String(authError.retryAfter) }
        : undefined,
    );
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
    let source: { path: string; name: string };
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      stagingDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
      source = await receiveUpload(request, stagingDir);
    } else {
      source = await findStoredFile(request);
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

async function findStoredFile(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const fileId: unknown = body?.fileId;
  if (typeof fileId !== "string" || !fileId) {
    throw new ConversionError("fileId is required", 400);
  }

  const file = db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.id, fileId), isNull(filesTable.deletedAt)))
    .get();
  if (!file) throw new ConversionError("File not found", 404);

  const storagePath = toStoragePath(file.key);
  if (!(await accessPath(storagePath))) {
    throw new ConversionError("File not found", 404);
  }

  return { path: storagePath, name: file.name };
}

async function receiveUpload(request: NextRequest, stagingDir: string) {
  // the staged copy occupies the data volume until the conversion ends
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 0) {
    const available = await getAvailableStorage(BASE_DATA_PATH);
    if (available > 0 && declaredSize > available) {
      throw new ConversionError("Not enough free space", 507);
    }
  }

  await fs.mkdir(stagingDir, { recursive: true });

  try {
    const { files } = await parseMultipartToDisk(
      request,
      stagingDir,
      getLimits().maxUploadSize,
    );
    if (files.length !== 1) {
      throw new ConversionError("Send exactly one file", 400);
    }
    return { path: files[0].stagedPath, name: files[0].originalName };
  } catch (error) {
    if (
      error instanceof UploadTooLargeError ||
      error instanceof TooManyFilesError
    ) {
      throw new ConversionError(error.message, 413);
    }
    throw error;
  }
}
