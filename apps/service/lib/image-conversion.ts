import {
  IMAGE_FORMAT_INFO,
  isImageFormat,
  MAX_IMAGE_DIMENSION,
  type ImageFormat,
} from "@/utils/conversion";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp, { type Metadata } from "sharp";
import { ConversionError } from "./conversion";
import { createTurnQueue } from "./turn-queue";

const execFileAsync = promisify(execFile);

// sharp's prebuilt libvips leaves out HEVC, so HEIC goes through libheif's decoder
const HEIF_DEC = process.env.HEIF_DEC_PATH || "heif-dec";

// what sharp reports in `metadata().format` for the images this reads
const READABLE_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "gif",
  "tiff",
  "svg",
  "heif",
]);

// sharp runs on libuv's thread pool, which thumbnails and file I/O also need;
// a conversion takes seconds, so a few wait their turn rather than being refused
export const { isBusy, acquireTurn } = createTurnQueue({
  maxRunning: 1,
  maxWaiting: 8,
});

export interface ImageOptions {
  format: ImageFormat;
  /** 1 to 100, or null for the format's default. Ignored for PNG. */
  quality: number | null;
  /** The box the image is fitted inside, never enlarged past its own size. */
  width: number | null;
  height: number | null;
}

function parseWholeNumber(
  value: unknown,
  name: string,
  max: number,
): number | null {
  if (value === undefined || value === null || value === "") return null;

  const number =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new ConversionError(
      `${name} must be a whole number from 1 to ${max}`,
      400,
    );
  }
  return number;
}

/** Reads the options from a JSON body or form fields, which arrive as strings. */
export function parseImageOptions(
  fields: Record<string, unknown>,
): ImageOptions {
  const requested =
    typeof fields.format === "string" ? fields.format.toLowerCase() : "";
  const format = requested === "jpg" ? "jpeg" : requested;
  if (!isImageFormat(format)) {
    throw new ConversionError(
      "format must be one of webp, jpeg, png or avif",
      400,
    );
  }

  return {
    format,
    quality: parseWholeNumber(fields.quality, "quality", 100),
    width: parseWholeNumber(fields.width, "width", MAX_IMAGE_DIMENSION),
    height: parseWholeNumber(fields.height, "height", MAX_IMAGE_DIMENSION),
  };
}

const unreadable = () =>
  new ConversionError("This file isn't an image that can be read", 422);

/** Decodes a HEIC to a PNG in `workDir`, upright, and returns its path. */
async function decodeHeic(
  input: string,
  workDir: string,
  signal: AbortSignal,
): Promise<string> {
  await fs.mkdir(workDir, { recursive: true });
  const output = path.join(workDir, `${crypto.randomUUID()}.png`);

  try {
    // no compression: the PNG is read once, straight back into sharp
    await execFileAsync(
      HEIF_DEC,
      ["--quiet", "--png-compression-level", "0", input, output],
      { signal, timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
      throw new ConversionError(
        "This server can't read HEIC images until libheif is installed",
        503,
      );
    }
    if (signal.aborted) throw signal.reason;
    throw unreadable();
  }

  return output;
}

/** The density that draws an SVG at the requested size, when that is larger. */
function svgDensity(
  { width: ownWidth, height: ownHeight }: Metadata,
  { width, height }: ImageOptions,
): number | undefined {
  if (!ownWidth || !ownHeight || (!width && !height)) return undefined;

  const scale = Math.min(
    width ? width / ownWidth : Infinity,
    height ? height / ownHeight : Infinity,
  );
  // 72 is the density sharp draws SVGs at by default
  return scale > 1 ? Math.min(72 * scale, 100_000) : undefined;
}

/**
 * Converts the image at `input` and returns the result. Metadata such as
 * camera details and location is left out, and the image is turned upright.
 * `workDir` holds a decoded HEIC meanwhile; the caller removes it.
 */
export async function convertImage(
  input: string,
  options: ImageOptions,
  { signal, workDir }: { signal: AbortSignal; workDir: string },
): Promise<{ data: Buffer; width: number; height: number }> {
  let metadata: Metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw unreadable();
  }
  if (!metadata.format || !READABLE_FORMATS.has(metadata.format)) {
    throw unreadable();
  }

  // AVIF shares HEIF's container and sharp decodes it; HEIC needs libheif
  const isHeic = metadata.format === "heif" && metadata.compression !== "av1";
  const isSvg = metadata.format === "svg";

  let source: string | Buffer = input;
  if (isHeic) {
    source = await decodeHeic(input, workDir, signal);
  } else if (isSvg) {
    // without a path, librsvg can't pull in other files the SVG refers to
    source = await fs.readFile(input);
  }

  const { format, width, height } = options;
  const quality =
    options.quality ?? IMAGE_FORMAT_INFO[format].defaultQuality ?? undefined;

  const image = sharp(source, {
    // libheif already turned a HEIC upright
    autoOrient: !isHeic,
    // only WebP output keeps the frames of an animation; others take the first
    animated:
      format === "webp" &&
      (metadata.format === "gif" || metadata.format === "webp"),
    density: isSvg ? svgDensity(metadata, options) : undefined,
    failOn: "truncated",
  }).timeout({ seconds: 60 });

  if (width || height) {
    image.resize({
      width: width ?? undefined,
      height: height ?? undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  switch (format) {
    case "jpeg":
      // JPG has no transparency, so it shows as white rather than black
      image.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true });
      break;
    case "png":
      image.png();
      break;
    case "webp":
      image.webp({ quality });
      break;
    case "avif":
      image.avif({ quality });
      break;
  }

  try {
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.pageHeight ?? info.height,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const { label } = IMAGE_FORMAT_INFO[format];
    if (/too large/i.test(message)) {
      throw new ConversionError(
        `This image is too large for ${label}, choose a smaller size`,
        422,
      );
    }
    throw new ConversionError(
      `This image is damaged or can't be converted to ${label}`,
      422,
    );
  }
}
