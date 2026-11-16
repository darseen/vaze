import { BASE_DATA_PATH } from "@/constants";
import { db } from "@/db";
import { ConversionError } from "@/lib/conversion";
import { getLimits } from "@/lib/settings";
import { getAvailableStorage } from "@/utils/storage";
import { files as filesTable } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { accessPath, toStoragePath } from ".";
import {
  parseMultipartToDisk,
  TooManyFilesError,
  UploadTooLargeError,
} from "./multipart";

/** The file a conversion reads, and the name its result is named after. */
export interface ConversionSource {
  path: string;
  name: string;
}

export const jsonError = (
  message: string,
  status: number,
  retryAfter?: number,
) =>
  NextResponse.json(
    { error: { message }, data: null },
    {
      status,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    },
  );

export const busy = () =>
  jsonError(
    "The server is busy converting other files, try again soon",
    503,
    10,
  );

export async function findStoredFile(
  fileId: unknown,
): Promise<ConversionSource> {
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

/** Stages the one file of a multipart body in `stagingDir`, with the form's fields. */
export async function receiveUpload(
  request: NextRequest,
  stagingDir: string,
): Promise<{ source: ConversionSource; fields: Record<string, string> }> {
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
    const { files, fields } = await parseMultipartToDisk(
      request,
      stagingDir,
      getLimits().maxUploadSize,
    );
    if (files.length !== 1) {
      throw new ConversionError("Send exactly one file", 400);
    }
    return {
      source: { path: files[0].stagedPath, name: files[0].originalName },
      fields,
    };
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
