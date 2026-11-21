import {
  GIF_DEFAULT_FRAME_RATE,
  GIF_DEFAULT_RESOLUTION,
  isVideoFormat,
  MAX_VIDEO_FRAME_RATE,
  MAX_VIDEO_RESOLUTION,
  MIN_VIDEO_RESOLUTION,
  MIN_VIDEO_TARGET_SIZE,
  parseTimestamp,
  VIDEO_CODEC_INFO,
  VIDEO_FORMAT_INFO,
  VIDEO_FORMATS,
  VIDEO_QUALITIES,
  type VideoQuality,
} from "@/utils/conversion";
import type { VideoCodec, VideoFormat } from "@repo/types";
import { ConversionError } from "../conversion";

export interface VideoOptions {
  format: VideoFormat;
  /** Null for a GIF or an MP3. */
  codec: VideoCodec | null;
  quality: VideoQuality;
  /** Bytes the result should fit in, in place of `quality`. */
  targetSize: number | null;
  /** The short side to fit, e.g. 720; never made larger. */
  resolution: number | null;
  /** The most frames a second; a slower video keeps its own. */
  fps: number | null;
  /** Seconds into the video where the result starts and ends. */
  start: number;
  end: number | null;
  audio: boolean;
}

// names other tools use for the same codecs
const CODEC_ALIASES: Record<string, VideoCodec> = {
  avc: "h264",
  "h.264": "h264",
  hevc: "h265",
  "h.265": "h265",
};

const isBlank = (value: unknown) =>
  value === undefined || value === null || value === "";

const invalid = (message: string) => new ConversionError(message, 400);

const list = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;

function parseNumber(
  value: unknown,
  name: string,
  min: number,
  max: number,
  { whole }: { whole: boolean },
): number {
  const number =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
  if (
    !Number.isFinite(number) ||
    (whole && !Number.isInteger(number)) ||
    number < min ||
    number > max
  ) {
    throw invalid(
      `${name} must be ${whole ? "a whole number" : "a number"} from ${min} to ${max}`,
    );
  }
  return number;
}

/** "original" or nothing leaves the video as it is. */
const isOriginal = (value: unknown) =>
  isBlank(value) || String(value).toLowerCase() === "original";

function parseTime(value: unknown, name: string): number {
  const seconds = parseTimestamp(value);
  if (seconds === null) {
    throw invalid(`${name} must be seconds, or a time such as "1:30"`);
  }
  return seconds;
}

function parseCodec(format: VideoFormat, value: unknown): VideoCodec | null {
  const { label, codecs } = VIDEO_FORMAT_INFO[format];
  if (codecs.length === 0) {
    if (!isBlank(value)) {
      throw invalid(
        `${format === "gif" ? "A GIF" : "An MP3"} has no codec to choose`,
      );
    }
    return null;
  }
  if (isBlank(value)) return codecs[0];

  const name = String(value).toLowerCase();
  const codec = CODEC_ALIASES[name] ?? name;
  if (!codecs.includes(codec as VideoCodec)) {
    throw invalid(
      `codec must be ${list(codecs)} for ${label}, as it can't hold ${VIDEO_CODEC_INFO[codec as VideoCodec]?.label ?? name}`,
    );
  }
  return codec as VideoCodec;
}

export function parseVideoOptions(
  fields: Record<string, unknown>,
): VideoOptions {
  const format = isBlank(fields.format)
    ? "mp4"
    : String(fields.format).toLowerCase();
  if (!isVideoFormat(format)) {
    throw invalid(`format must be ${list(VIDEO_FORMATS)}`);
  }
  const codec = parseCodec(format, fields.codec);

  const quality = isBlank(fields.quality)
    ? "balanced"
    : String(fields.quality).toLowerCase();
  if (!VIDEO_QUALITIES.includes(quality as VideoQuality)) {
    throw invalid(`quality must be ${list(VIDEO_QUALITIES)}`);
  }

  const targetSize = isBlank(fields.targetSize)
    ? null
    : parseNumber(
        fields.targetSize,
        "targetSize",
        MIN_VIDEO_TARGET_SIZE,
        Number.MAX_SAFE_INTEGER,
        { whole: true },
      );
  if (targetSize !== null && !isBlank(fields.quality)) {
    throw invalid("Send quality or targetSize, not both");
  }

  // "720p" reads as 720
  const resolutionField =
    typeof fields.resolution === "string"
      ? fields.resolution.replace(/p$/i, "")
      : fields.resolution;
  let resolution = isOriginal(fields.resolution)
    ? null
    : parseNumber(
        resolutionField,
        "resolution",
        MIN_VIDEO_RESOLUTION,
        MAX_VIDEO_RESOLUTION,
        { whole: true },
      );
  let fps = isOriginal(fields.fps)
    ? null
    : parseNumber(fields.fps, "fps", 1, MAX_VIDEO_FRAME_RATE, {
        whole: false,
      });

  const start = isBlank(fields.start) ? 0 : parseTime(fields.start, "start");
  const end = isBlank(fields.end) ? null : parseTime(fields.end, "end");
  if (end !== null && end <= start) throw invalid("end must come after start");

  let audio = true;
  if (!isBlank(fields.audio)) {
    if (fields.audio === false || fields.audio === "false") audio = false;
    else if (fields.audio !== true && fields.audio !== "true") {
      throw invalid("audio must be true or false");
    }
  }

  if (codec === "copy") {
    const changes = ["quality", "targetSize", "resolution", "fps"].filter(
      (name) => !isOriginal(fields[name]),
    );
    if (changes.length > 0) {
      throw invalid(
        `codec "copy" keeps the video as it is, so it can't change ${list(changes)}. Choose a codec to convert it`,
      );
    }
  }

  if (format === "gif") {
    if (targetSize !== null) {
      throw invalid(
        "A GIF can't be fitted to a size. Choose a quality, a smaller resolution or a lower fps instead",
      );
    }
    // "original" keeps either as it is; leaving them out keeps the GIF small
    if (isBlank(fields.resolution)) resolution = GIF_DEFAULT_RESOLUTION;
    if (isBlank(fields.fps)) fps = GIF_DEFAULT_FRAME_RATE;
    audio = false;
  }

  if (format === "mp3") {
    // only the sound is kept, so nothing about the picture applies
    const changes = ["resolution", "fps"].filter(
      (name) => !isOriginal(fields[name]),
    );
    if (changes.length > 0) {
      throw invalid(
        `An MP3 is only the sound, so it can't change ${list(changes)}`,
      );
    }
    if (targetSize !== null) {
      throw invalid(
        "An MP3 can't be fitted to a size. Choose a quality instead",
      );
    }
    if (!audio) throw invalid("An MP3 is the sound, so audio can't be false");
  }

  return {
    format,
    codec,
    quality: quality as VideoQuality,
    targetSize,
    resolution,
    fps,
    start,
    end,
    audio,
  };
}
