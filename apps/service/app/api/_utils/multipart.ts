import { MAX_FILES_PER_REQUEST, MAX_UPLOAD_SIZE } from "@/constants";
import Busboy from "busboy";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export class UploadTooLargeError extends Error {
  constructor() {
    super(`File exceeds the maximum upload size of ${MAX_UPLOAD_SIZE} bytes`);
    this.name = "UploadTooLargeError";
  }
}

export class TooManyFilesError extends Error {
  constructor() {
    super(`An upload may contain at most ${MAX_FILES_PER_REQUEST} files`);
    this.name = "TooManyFilesError";
  }
}

export interface StagedFile {
  originalName: string;
  stagedPath: string;
  size: number;
}

export interface ParsedUpload {
  fields: Record<string, string>;
  files: StagedFile[];
}

/**
 * Stream a multipart body straight to disk.
 *
 * Every part is written into `stagingDir` under a random name as it arrives, so
 * memory stays flat regardless of upload size and nothing lands in the target
 * folder until the whole body has parsed. The caller owns `stagingDir` and is
 * responsible for removing it.
 */
export function parseMultipartToDisk(
  request: Request,
  stagingDir: string,
): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get("content-type") ?? "";
    const body = request.body;

    if (!body) {
      reject(new Error("Missing request body"));
      return;
    }

    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = (result: ParsedUpload) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: {
        fileSize: MAX_UPLOAD_SIZE,
        files: MAX_FILES_PER_REQUEST,
      },
    });

    const fields: Record<string, string> = {};
    const files: StagedFile[] = [];
    const writes: Promise<void>[] = [];

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (_name, stream, info) => {
      const stagedPath = path.join(stagingDir, crypto.randomUUID());
      let truncated = false;

      // busboy signals the fileSize limit by truncating the stream, not by
      // erroring — without this the caller would silently store a partial file.
      stream.on("limit", () => {
        truncated = true;
      });

      const write = pipeline(stream, createWriteStream(stagedPath)).then(
        async () => {
          if (truncated) throw new UploadTooLargeError();
          const { size } = await fs.stat(stagedPath);
          files.push({ originalName: info.filename, stagedPath, size });
        },
      );

      writes.push(write);
      write.catch(fail);
    });

    busboy.on("filesLimit", () => fail(new TooManyFilesError()));
    busboy.on("error", (error) =>
      fail(error instanceof Error ? error : new Error(String(error))),
    );

    busboy.on("close", () => {
      Promise.all(writes)
        .then(() => succeed({ fields, files }))
        .catch(fail);
    });

    const nodeStream = Readable.fromWeb(body as never);
    nodeStream.on("error", fail);
    nodeStream.pipe(busboy);
  });
}
