import type { VideoCodec, VideoFormat } from "@repo/types";
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

/** What videos convert to, in the order the dashboard offers them. */
export const VIDEO_FORMATS = [
  "mp4",
  "webm",
  "mov",
  "mkv",
  "gif",
] as const satisfies readonly VideoFormat[];

export const VIDEO_FORMAT_INFO: Record<
  VideoFormat,
  {
    label: string;
    extension: string;
    mimeType: string;
    /** The codecs it holds, its default first; a GIF has none to pick. */
    codecs: VideoCodec[];
  }
> = {
  mp4: {
    label: "MP4",
    extension: "mp4",
    mimeType: "video/mp4",
    codecs: ["h264", "h265", "av1", "copy"],
  },
  webm: {
    label: "WebM",
    extension: "webm",
    mimeType: "video/webm",
    codecs: ["vp9", "av1", "copy"],
  },
  mov: {
    label: "MOV",
    extension: "mov",
    mimeType: "video/quicktime",
    codecs: ["h264", "h265", "copy"],
  },
  mkv: {
    label: "MKV",
    extension: "mkv",
    mimeType: "video/x-matroska",
    codecs: ["h264", "h265", "vp9", "av1", "copy"],
  },
  gif: {
    label: "GIF",
    extension: "gif",
    mimeType: "image/gif",
    codecs: [],
  },
};

export const VIDEO_CODEC_INFO: Record<
  VideoCodec,
  { label: string; hint: string }
> = {
  h264: { label: "H.264", hint: "Plays on every device and site" },
  h265: {
    label: "H.265 (HEVC)",
    hint: "Smaller, for phones and newer devices",
  },
  vp9: { label: "VP9", hint: "Plays in every browser" },
  av1: { label: "AV1", hint: "Smallest, slower to make, for newer devices" },
  copy: {
    label: "Keep original",
    hint: "Changes only the container, in seconds and without loss",
  },
};

export const isVideoFormat = (value: unknown): value is VideoFormat =>
  VIDEO_FORMATS.includes(value as VideoFormat);

/** How hard a video is compressed when it isn't fitted to a target size. */
export const VIDEO_QUALITIES = ["high", "balanced", "small"] as const;

export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

/** Short sides offered, e.g. 720 for 1280 × 720 or 720 × 1280. */
export const VIDEO_RESOLUTIONS = [2160, 1440, 1080, 720, 480, 360, 240];

export const MIN_VIDEO_RESOLUTION = 64;
export const MAX_VIDEO_RESOLUTION = 4320;

/** Frame rates offered as a cap; a video slower than the cap keeps its own. */
export const VIDEO_FRAME_RATES = [60, 30, 24, 15, 10];

export const MAX_VIDEO_FRAME_RATE = 120;

/** GIFs hold every frame as a picture, so they are kept short. */
export const MAX_GIF_SECONDS = 60;

/** What a GIF gets when the request names no size or frame rate. */
export const GIF_DEFAULT_RESOLUTION = 480;
export const GIF_DEFAULT_FRAME_RATE = 15;

/** The smallest target size taken, as less can't hold a picture worth seeing. */
export const MIN_VIDEO_TARGET_SIZE = 100 * 1024;

export const toVideoName = (name: string, format: VideoFormat) =>
  withExtension(name, VIDEO_FORMAT_INFO[format].extension, "video");

/** Reads seconds as a number, or text such as "90", "1:30" or "1:02:03.5"; null if it's neither. */
export function parseTimestamp(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  const match = /^\s*(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;

  const [, first, second, rest] = match;
  const hours = second !== undefined ? Number(first) : 0;
  const minutes = second !== undefined ? Number(second) : Number(first ?? 0);
  const seconds = Number(rest);
  // a unit below another runs to 59
  if (
    (first !== undefined && seconds >= 60) ||
    (second !== undefined && minutes >= 60)
  ) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

/** e.g. "0:07", "12:30" or "1:02:03". */
export function formatTimestamp(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Whether the server can read `file` as a video to convert, animated GIFs included. */
export const isConvertibleVideo = (file: { name: string; mimeType: string }) =>
  isVideo(file) || file.mimeType === "image/gif" || /\.gif$/i.test(file.name);

/** The picker's `accept` for videos, naming the types some systems don't file under video/*. */
export const VIDEO_ACCEPT =
  "video/*,image/gif,.mkv,.mov,.avi,.wmv,.flv,.ts,.mts,.m2ts,.3gp,.ogv";
