import { BASE_TMP_PATH } from "@/constants";
import { ConversionError } from "@/lib/conversion";
import { fileStream } from "@/lib/file-stream";
import { streamZipResponse, type ZipEntry } from "@/lib/zip";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { contentDisposition } from ".";
import authorizeRequest from "./authorize-request";
import {
  busy,
  jsonError,
  receiveSources,
  type ConversionSource,
} from "./conversion";
import { isClientAbort } from "./multipart";

/** What a PDF tool sends back: one file from disk, or several as a ZIP. */
export type PdfToolResult =
  | {
      kind: "file";
      path: string;
      name: string;
      headers?: Record<string, string>;
    }
  | {
      kind: "zip";
      entries: ZipEntry[];
      /** Without ".zip". */
      name: string;
      headers?: Record<string, string>;
    };

interface Queue {
  isBusy: () => boolean;
  acquireTurn: (signal: AbortSignal) => Promise<(() => void) | null>;
}

interface PdfTool<Options> {
  bucket: string;
  limit: number;
  sources: { min: number; max: number };
  queue: Queue;
  /** Why the tool is turned off on this server, if it is. */
  disabled?: () => string | null;
  /** Checks the options before the request waits its turn. */
  parse: (
    fields: Record<string, unknown>,
    sources: ConversionSource[],
  ) => Options;
  run: (job: {
    sources: ConversionSource[];
    options: Options;
    /** Scratch space for the job's results, removed once the response is sent. */
    workDir: string;
    signal: AbortSignal;
  }) => Promise<PdfToolResult>;
  /** Names the tool in the server's logs. */
  label: string;
}

/** Calls `cleanUp` once `body` has been read to the end, failed or been canceled. */
function withCleanUp(
  body: ReadableStream<Uint8Array>,
  cleanUp: () => void,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            cleanUp();
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          cleanUp();
          throw error;
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          cleanUp();
        }
      },
    },
    { highWaterMark: 0 },
  );
}

async function respond(
  result: PdfToolResult,
  cleanUp: () => void,
): Promise<Response> {
  if (result.kind === "zip") {
    const zip = streamZipResponse(result.entries, result.name);
    for (const [name, value] of Object.entries(result.headers ?? {})) {
      zip.headers.set(name, value);
    }
    return new NextResponse(withCleanUp(zip.body!, cleanUp), {
      headers: zip.headers,
    });
  }

  const { size } = await fs.stat(result.path);
  return new Response(
    withCleanUp(fileStream(result.path, 0, size - 1), cleanUp),
    {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(size),
        "Content-Disposition": contentDisposition("attachment", result.name),
        "Cache-Control": "no-store",
        ...result.headers,
      },
    },
  );
}

/** Runs a PDF tool's request in a scratch folder of its own, removed once the result is sent. */
export async function handlePdfTool<Options>(
  request: NextRequest,
  tool: PdfTool<Options>,
): Promise<Response> {
  const { error: authError } = await authorizeRequest(request, {
    scope: "files:read",
    bucket: tool.bucket,
    limit: tool.limit,
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  // refuse before a device upload is read, not after
  const disabled = tool.disabled?.();
  if (disabled) return jsonError(disabled, 501);
  if (tool.queue.isBusy()) return busy();

  const workDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
  let release: (() => void) | null = null;
  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    release?.();
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const { sources, fields } = await receiveSources(
      request,
      path.join(workDir, "upload"),
      tool.sources,
    );
    const options = tool.parse(fields, sources);

    release = await tool.queue.acquireTurn(request.signal);
    if (!release) {
      cleanUp();
      return busy();
    }

    const output = path.join(workDir, "output");
    await fs.mkdir(output, { recursive: true });
    const result = await tool.run({
      sources,
      options,
      workDir: output,
      signal: request.signal,
    });

    // the next job needn't wait while this one's result downloads
    release();
    return await respond(result, cleanUp);
  } catch (error) {
    cleanUp();

    if (error instanceof ConversionError) {
      return jsonError(error.message, error.status);
    }
    if (request.signal.aborted || isClientAbort(error)) {
      return new NextResponse(null, { status: 499 });
    }

    console.error(`${tool.label} error`, error);
    return jsonError("Failed to make the PDF", 500);
  }
}
