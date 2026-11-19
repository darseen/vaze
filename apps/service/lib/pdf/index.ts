import type { ConversionSource } from "@/app/api/_utils/conversion";
import {
  MAX_PAGE_MARGIN,
  MAX_PDF_INPUT_SIZE,
  PAGE_SIZES,
  parsePageRanges,
  ROTATIONS,
  type EditedPage,
  type PageRange,
  type PageSize,
  type Rotation,
} from "@/utils/pdf-tools";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import sharp, { type Metadata } from "sharp";
import { ConversionError } from "../conversion";
import { convertImage } from "../image-conversion";
import { createTurnQueue } from "../turn-queue";
import type {
  PdfJob,
  PdfJobFailure,
  PdfJobResult,
  PdfWorkerMessage,
  PreparedImage,
} from "./jobs";

// each job gets a worker of its own, and pdf-lib holds whole files in memory
export const { isBusy, acquireTurn } = createTurnQueue({
  maxRunning: 1,
  maxWaiting: 8,
});

// pdf-lib's parsed objects live on the worker's heap; file bytes sit outside it
const WORKER_HEAP_MB = 1536;

const FAILURE_STATUS: Record<PdfJobFailure["code"], number> = {
  encrypted: 422,
  unreadable: 422,
  input: 422,
  "too-large": 413,
};

/** Runs `job` on a worker thread of its own, which is stopped if `signal` aborts. */
export function runPdfJob(
  job: PdfJob,
  signal: AbortSignal,
): Promise<PdfJobResult> {
  signal.throwIfAborted();

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    workerData: job,
    resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
  });

  return new Promise<PdfJobResult>((resolve, reject) => {
    let settled = false;
    const settle = (finish: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", stop);
      finish();
    };
    const stop = () => {
      settle(() => reject(signal.reason));
      void worker.terminate();
    };
    signal.addEventListener("abort", stop, { once: true });

    worker.once("message", (message: PdfWorkerMessage) =>
      settle(() =>
        message.ok
          ? resolve(message.result)
          : reject(
              new ConversionError(
                message.failure.message,
                FAILURE_STATUS[message.failure.code],
              ),
            ),
      ),
    );
    worker.once("error", (error: NodeJS.ErrnoException) =>
      settle(() => {
        if (error.code === "ERR_WORKER_OUT_OF_MEMORY") {
          reject(
            new ConversionError(
              "These files are too complex to work on at once, try fewer or smaller ones",
              413,
            ),
          );
          return;
        }
        // pdf-lib read the file but tripped over something in it
        console.error("pdf job failed", error);
        reject(
          new ConversionError(
            "This PDF is damaged or uses something that can't be worked on",
            422,
          ),
        );
      }),
    );
    worker.once("exit", (code) =>
      settle(() => reject(new Error(`pdf worker exited with ${code}`))),
    );
  });
}

/** Refuses inputs whose sizes together are more than one job reads. */
export function checkInputSize(sources: ConversionSource[]) {
  const total = sources.reduce((sum, { size }) => sum + size, 0);
  if (total > MAX_PDF_INPUT_SIZE) {
    throw new ConversionError(
      `These files come to more than the ${MAX_PDF_INPUT_SIZE / 1024 ** 2} MB one request can work on`,
      413,
    );
  }
}

/** Gives each image a form a PDF holds: an upright RGB or gray JPG as it is, else a converted JPG or PNG. */
export async function prepareImages(
  sources: ConversionSource[],
  workDir: string,
  signal: AbortSignal,
): Promise<PreparedImage[]> {
  const prepared: PreparedImage[] = [];

  for (const source of sources) {
    signal.throwIfAborted();

    let metadata: Metadata | null = null;
    try {
      metadata = await sharp(source.path).metadata();
    } catch {
      // convertImage reports it, naming the image below
    }

    const { format, orientation, space, width, height } = metadata ?? {};
    if (
      format === "jpeg" &&
      (!orientation || orientation === 1) &&
      (space === "srgb" || space === "b-w") &&
      width &&
      height
    ) {
      prepared.push({ path: source.path, type: "jpg", width, height });
      continue;
    }

    // drawings, screenshots and anything see-through stay lossless
    const lossless =
      format === "png" ||
      format === "gif" ||
      format === "svg" ||
      Boolean(metadata?.hasAlpha);
    const imageFormat = lossless ? "png" : "jpeg";

    let converted;
    try {
      converted = await convertImage(
        source.path,
        { format: imageFormat, quality: 92, width: null, height: null },
        { signal, workDir },
      );
    } catch (error) {
      if (error instanceof ConversionError && error.status === 422) {
        throw new ConversionError(
          `${source.name} isn't an image that can be read`,
          422,
        );
      }
      throw error;
    }

    const output = path.join(
      workDir,
      `${crypto.randomUUID()}.${lossless ? "png" : "jpg"}`,
    );
    await fs.writeFile(output, converted.data);
    prepared.push({
      path: output,
      type: lossless ? "png" : "jpg",
      width: converted.width,
      height: converted.height,
    });
  }

  return prepared;
}

const isBlank = (value: unknown) =>
  value === undefined || value === null || value === "";

function parseFlag(value: unknown, name: string): boolean {
  if (isBlank(value) || value === false || value === "false") return false;
  if (value === true || value === "true") return true;
  throw new ConversionError(`${name} must be true or false`, 400);
}

function parseWholeNumber(
  value: unknown,
  name: string,
  min: number,
  max: number,
): number {
  const number =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ConversionError(
      `${name} must be a whole number from ${min} to ${max}`,
      400,
    );
  }
  return number;
}

/** Form fields carry lists as JSON text. */
function parseList(value: unknown, name: string): unknown[] {
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      list = null;
    }
  }
  if (!Array.isArray(list)) {
    throw new ConversionError(`${name} must be a list`, 400);
  }
  return list;
}

export function parseSplitOptions(
  fields: Record<string, unknown>,
): { ranges: PageRange[] } | { every: number } {
  if (!isBlank(fields.ranges)) {
    if (!isBlank(fields.every)) {
      throw new ConversionError("Send ranges or every, not both", 400);
    }
    if (typeof fields.ranges !== "string") {
      throw new ConversionError('ranges must be text such as "1-3, 4-6"', 400);
    }
    const ranges = parsePageRanges(fields.ranges);
    if (typeof ranges === "string") {
      throw new ConversionError(`ranges: ${ranges}`, 400);
    }
    return { ranges };
  }

  return {
    every: isBlank(fields.every)
      ? 1
      : parseWholeNumber(fields.every, "every", 1, 10_000),
  };
}

export interface EditOptions {
  pages: EditedPage[] | null;
  pageNumbers: boolean;
  title: string | null;
}

export function parseEditOptions(fields: Record<string, unknown>): EditOptions {
  let pages: EditedPage[] | null = null;
  if (!isBlank(fields.pages)) {
    const list = parseList(fields.pages, "pages");
    if (list.length === 0) {
      throw new ConversionError("pages must keep at least one page", 400);
    }
    pages = list.map((item) => {
      // a bare number keeps that page as it is
      const entry =
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : { page: item };
      const rotate = isBlank(entry.rotate) ? 0 : Number(entry.rotate);
      if (!ROTATIONS.includes(rotate as Rotation)) {
        throw new ConversionError("rotate must be 0, 90, 180 or 270", 400);
      }
      return {
        page: parseWholeNumber(entry.page, "page", 1, 1_000_000),
        rotate: rotate as Rotation,
      };
    });
  }

  let title: string | null = null;
  if (!isBlank(fields.title)) {
    if (typeof fields.title !== "string" || fields.title.length > 500) {
      throw new ConversionError(
        "title must be text of 500 characters or fewer",
        400,
      );
    }
    title = fields.title.trim() || null;
  }

  return {
    pages,
    pageNumbers: parseFlag(fields.pageNumbers, "pageNumbers"),
    title,
  };
}

export function parseImagesOptions(fields: Record<string, unknown>): {
  pageSize: PageSize;
  margin: number;
} {
  const pageSize = isBlank(fields.pageSize)
    ? "fit"
    : String(fields.pageSize).toLowerCase();
  if (!PAGE_SIZES.includes(pageSize as PageSize)) {
    throw new ConversionError("pageSize must be fit, a4 or letter", 400);
  }
  return {
    pageSize: pageSize as PageSize,
    margin: isBlank(fields.margin)
      ? 0
      : parseWholeNumber(fields.margin, "margin", 0, MAX_PAGE_MARGIN),
  };
}
