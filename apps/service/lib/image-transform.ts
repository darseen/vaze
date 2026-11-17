import { isImageFormat, type ImageFormat } from "@/utils/conversion";

/**
 * The widths a hosting URL may resize to. Hosting is public, so open-ended
 * sizes would let anyone fill the disk with cached copies of one image.
 */
export const HOSTED_IMAGE_WIDTHS = [
  64, 128, 256, 320, 480, 640, 800, 1024, 1280, 1600, 1920, 2560,
] as const;

/** A resize or conversion asked of a hosted image. Null fields were left out. */
export interface ImageTransform {
  width: number | null;
  format: ImageFormat | null;
}

export type ParsedTransform =
  | { transform: ImageTransform | null; error: null }
  | { transform: null; error: string };

function parseWidth(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;

  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^[1-9]\d*$/.test(text)) return undefined;

  const width = Number(text);
  return (HOSTED_IMAGE_WIDTHS as readonly number[]).includes(width)
    ? width
    : undefined;
}

function parseFormat(value: unknown): ImageFormat | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;

  const requested = value.toLowerCase();
  const format = requested === "jpg" ? "jpeg" : requested;
  return isImageFormat(format) ? format : undefined;
}

/**
 * Reads a width and format, from a hosting URL's `w` and `format` or a JSON
 * body. `transform` is null when neither was given, which serves the original.
 */
export function parseImageTransform({
  width: rawWidth,
  format: rawFormat,
  widthName = "width",
}: {
  width: unknown;
  format: unknown;
  widthName?: string;
}): ParsedTransform {
  const width = parseWidth(rawWidth);
  if (width === undefined) {
    return {
      transform: null,
      error: `${widthName} must be one of ${HOSTED_IMAGE_WIDTHS.join(", ")}`,
    };
  }

  const format = parseFormat(rawFormat);
  if (format === undefined) {
    return {
      transform: null,
      error: "format must be one of webp, jpeg, png or avif",
    };
  }

  const transform =
    width === null && format === null ? null : { width, format };
  return { transform, error: null };
}

/** The transform as URL params, in the fixed order signatures cover them. */
export function transformParams({ width, format }: ImageTransform) {
  const params = new URLSearchParams();
  if (width !== null) params.set("w", String(width));
  if (format !== null) params.set("format", format);
  return params;
}

// what a resize keeps when the URL names no format; anything else becomes WebP
const KEPT_FORMATS: Record<string, ImageFormat> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** The format a copy is written in: the one asked for, else the file's own. */
export function outputFormat(
  transform: ImageTransform,
  mimeType: string,
): ImageFormat {
  return transform.format ?? KEPT_FORMATS[mimeType] ?? "webp";
}
