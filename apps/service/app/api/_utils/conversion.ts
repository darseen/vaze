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
  size: number;
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

  return { path: storagePath, name: file.name, size: file.size };
}

/** Stages a multipart body's files in `stagingDir`, refusing one the volume can't hold. */
async function stageMultipart(request: NextRequest, stagingDir: string) {
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
    return await parseMultipartToDisk(
      request,
      stagingDir,
      getLimits().maxUploadSize,
    );
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

/** Stages the one file of a multipart body in `stagingDir`, with the form's fields. */
export async function receiveUpload(
  request: NextRequest,
  stagingDir: string,
): Promise<{ source: ConversionSource; fields: Record<string, string> }> {
  const { files, fields } = await stageMultipart(request, stagingDir);
  if (files.length !== 1) {
    throw new ConversionError("Send exactly one file", 400);
  }
  return {
    source: {
      path: files[0].stagedPath,
      name: files[0].originalName,
      size: files[0].size,
    },
    fields,
  };
}

const isMultipart = (request: NextRequest) =>
  request.headers.get("content-type")?.includes("multipart/form-data") ?? false;

/** Reads a conversion's files in order, by id from JSON or uploaded and by `fileId` field from multipart. */
export async function receiveSources(
  request: NextRequest,
  stagingDir: string,
  { min, max }: { min: number; max: number },
): Promise<{ sources: ConversionSource[]; fields: Record<string, unknown> }> {
  type Pending = ConversionSource | { fileId: string };
  let pending: Pending[];
  let fields: Record<string, unknown>;

  if (isMultipart(request)) {
    const upload = await stageMultipart(request, stagingDir);
    pending = upload.parts.flatMap((part): Pending[] => {
      if (part.kind === "file") {
        const { stagedPath, originalName, size } = part.file;
        return [{ path: stagedPath, name: originalName, size }];
      }
      return part.name === "fileId" ? [{ fileId: part.value }] : [];
    });
    fields = upload.fields;
  } else {
    const body: unknown = await request.json().catch(() => null);
    fields = (body && typeof body === "object" ? body : {}) as Record<
      string,
      unknown
    >;
    const ids = fields.fileIds ?? (fields.fileId ? [fields.fileId] : []);
    if (!Array.isArray(ids)) {
      throw new ConversionError("fileIds must be a list of file ids", 400);
    }
    pending = ids.map((fileId) => ({ fileId }));
  }

  const noun = max === 1 ? "one file" : `${min} to ${max} files`;
  if (pending.length < min || pending.length > max) {
    throw new ConversionError(
      pending.length === 0 ? "fileId is required" : `Send ${noun}`,
      400,
    );
  }

  const sources: ConversionSource[] = [];
  for (const item of pending) {
    sources.push("fileId" in item ? await findStoredFile(item.fileId) : item);
  }
  return { sources, fields };
}
