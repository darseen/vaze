import { getPreviewKind } from "./file-type";

/** Constant bitrate of converted audio, so its final size follows from the duration. */
export const MP3_BITRATE_KBPS = 192;

const withExtension = (name: string, extension: string, fallback: string) =>
  `${name.replace(/\.[^./\\]+$/, "") || fallback}.${extension}`;

export const toMp3Name = (name: string) => withExtension(name, "mp3", "audio");

/** Expected size in bytes of `seconds` of converted audio. */
export const expectedMp3Bytes = (seconds: number) =>
  Math.ceil((seconds * MP3_BITRATE_KBPS * 1000) / 8);

export const isVideo = (file: { name: string; mimeType: string }) =>
  getPreviewKind(file.name, file.mimeType) === "video";

/** What images convert to, in the order the dashboard offers them. */
export const IMAGE_FORMATS = ["webp", "jpeg", "png", "avif"] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const IMAGE_FORMAT_INFO: Record<
  ImageFormat,
  {
    label: string;
    extension: string;
    mimeType: string;
    /** Used when the request names none; null for lossless formats. */
    defaultQuality: number | null;
  }
> = {
  webp: {
    label: "WebP",
    extension: "webp",
    mimeType: "image/webp",
    defaultQuality: 80,
  },
  jpeg: {
    label: "JPG",
    extension: "jpg",
    mimeType: "image/jpeg",
    defaultQuality: 80,
  },
  png: {
    label: "PNG",
    extension: "png",
    mimeType: "image/png",
    defaultQuality: null,
  },
  avif: {
    label: "AVIF",
    extension: "avif",
    mimeType: "image/avif",
    defaultQuality: 50,
  },
};

/** The largest width or height a conversion may ask for. */
export const MAX_IMAGE_DIMENSION = 16384;

export const isImageFormat = (value: unknown): value is ImageFormat =>
  IMAGE_FORMATS.includes(value as ImageFormat);

export const toImageName = (name: string, format: ImageFormat) =>
  withExtension(name, IMAGE_FORMAT_INFO[format].extension, "image");

const CONVERTIBLE_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "jfif",
  "png",
  "webp",
  "avif",
  "gif",
  "tif",
  "tiff",
  "svg",
  "heic",
  "heif",
]);

const CONVERTIBLE_IMAGE_TYPES =
  /^image\/(jpeg|png|webp|avif|gif|tiff|svg\+xml|heic|heif)$/;

/** Whether the server can read `file` as an image to convert. */
export const isConvertibleImage = (file: { name: string; mimeType: string }) =>
  CONVERTIBLE_IMAGE_EXTENSIONS.has(
    /\.([^./\\]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? "",
  ) || CONVERTIBLE_IMAGE_TYPES.test(file.mimeType);
