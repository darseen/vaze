import { formatBytes } from "@/utils";
import {
  formatTimestamp,
  MAX_GIF_SECONDS,
  VIDEO_FORMAT_INFO,
  type VideoQuality,
} from "@/utils/conversion";
import type { VideoCodec, VideoFormat } from "@repo/types";
import path from "node:path";
import { ConversionError } from "../conversion";
import type { VideoOptions } from "./options";
import { VIDEO_INPUT_GUARDS, type VideoInfo } from "./probe";

export interface VideoPass {
  /** ffmpeg's arguments after the ones every run shares. */
  args: string[];
  /** Its share of the job's time, for progress; a plan's add up to 1. */
  weight: number;
}

export interface VideoPlan {
  passes: VideoPass[];
  /** The result's size in pixels. */
  width: number;
  height: number;
  /** Seconds in the result, when known. */
  duration: number | null;
  /** With a target size, the last pass again at a bitrate that fits, should the result come out over. */
  fit: { target: number; redo: (size: number) => VideoPass } | null;
}

type EncodedCodec = Exclude<VideoCodec, "copy">;

// constant quality per codec, as each counts differently for a similar look
const CRF: Record<EncodedCodec, Record<VideoQuality, number>> = {
  h264: { high: 20, balanced: 23, small: 28 },
  h265: { high: 22, balanced: 26, small: 30 },
  vp9: { high: 28, balanced: 33, small: 38 },
  av1: { high: 28, balanced: 35, small: 42 },
};

// Opus sounds as good as AAC at a lower bitrate
const AUDIO_KBPS: Record<"aac" | "opus", Record<VideoQuality, number>> = {
  aac: { high: 160, balanced: 128, small: 96 },
  opus: { high: 128, balanced: 96, small: 64 },
};

const GIF_PALETTES: Record<VideoQuality, { colors: number; dither: string }> = {
  high: { colors: 256, dither: "dither=sierra2_4a" },
  balanced: {
    colors: 256,
    dither: "dither=bayer:bayer_scale=4:diff_mode=rectangle",
  },
  small: {
    colors: 128,
    dither: "dither=bayer:bayer_scale=2:diff_mode=rectangle",
  },
};

// encoders land within a few percent of the bitrate asked for, so aim under
const FIT_MARGIN = 0.96;
// below this a frame is mostly blocks
const MIN_FIT_VIDEO_BPS = 50_000;

const MUXERS: Record<VideoFormat, string> = {
  mp4: "mp4",
  webm: "webm",
  mov: "mov",
  mkv: "matroska",
  gif: "gif",
};

// what each container holds as it is, by ffprobe's codec names
const COPYABLE: Record<
  Exclude<VideoFormat, "gif">,
  { video: string[]; audio: string[] }
> = {
  mp4: {
    video: ["h264", "hevc", "av1", "vp9", "mpeg4"],
    audio: ["aac", "mp3", "ac3", "eac3", "alac"],
  },
  mov: {
    video: ["h264", "hevc", "prores", "mpeg4", "mjpeg"],
    audio: ["aac", "mp3", "ac3", "eac3", "alac", "pcm_s16le", "pcm_s24le"],
  },
  mkv: {
    video: [
      "h264",
      "hevc",
      "av1",
      "vp8",
      "vp9",
      "mpeg4",
      "mpeg2video",
      "prores",
      "theora",
      "mjpeg",
    ],
    audio: [
      "aac",
      "mp3",
      "ac3",
      "eac3",
      "dts",
      "truehd",
      "opus",
      "vorbis",
      "flac",
      "alac",
      "pcm_s16le",
      "pcm_s24le",
    ],
  },
  webm: { video: ["vp8", "vp9", "av1"], audio: ["opus", "vorbis"] },
};

const CODEC_NAMES: Record<string, string> = {
  h264: "H.264",
  hevc: "H.265",
  av1: "AV1",
  vp8: "VP8",
  vp9: "VP9",
  mpeg4: "MPEG-4",
  mpeg2video: "MPEG-2",
  mpeg1video: "MPEG-1",
  prores: "ProRes",
  gif: "GIF",
  wmv3: "WMV",
};

// HDR to SDR in linear light, so colors don't come out washed out
const TONEMAP =
  "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv";

const seconds = (value: number) => value.toFixed(3);

const unusable = (message: string) => new ConversionError(message, 422);

/** Fits the short side in `resolution`, never larger, with even sides as yuv420p needs. */
function outputSize(info: VideoInfo, resolution: number | null) {
  const short = Math.min(info.width, info.height);
  const target = resolution !== null && short > resolution ? resolution : short;
  // the long side rounds to the nearest even number, e.g. 854 × 480, but never past the original
  const side = (length: number) => {
    const exact = (length * target) / short / 2;
    const even = (length === short ? Math.floor(exact) : Math.round(exact)) * 2;
    return Math.max(2, Math.min(even, Math.floor(length / 2) * 2));
  };
  return { width: side(info.width), height: side(info.height) };
}

function videoFilters(
  info: VideoInfo,
  options: VideoOptions,
  size: { width: number; height: number },
  gif: boolean,
): string[] {
  const filters: string[] = [];
  // dropping frames first leaves less to scale
  if (
    options.fps !== null &&
    (info.frameRate === null || info.frameRate > options.fps + 0.01)
  ) {
    filters.push(`fps=${options.fps}`);
  }
  if (size.width !== info.frameWidth || size.height !== info.frameHeight) {
    filters.push(
      `scale=${size.width}:${size.height}${gif ? ":flags=lanczos" : ""}`,
      "setsar=1",
    );
  }
  if (info.hdr) filters.push(TONEMAP);
  if (!gif) filters.push("format=yuv420p");
  return filters;
}

type RateControl =
  { crf: number } | { bitrate: number; pass: 1 | 2; passLog: string };

function encoderArgs(
  codec: EncodedCodec,
  format: VideoFormat,
  rate: RateControl,
): string[] {
  const control =
    "crf" in rate
      ? ["-crf", String(rate.crf)]
      : [
          "-b:v",
          String(Math.round(rate.bitrate)),
          "-pass",
          String(rate.pass),
          "-passlogfile",
          rate.passLog,
        ];

  switch (codec) {
    case "h264":
      return [
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-profile:v",
        "high",
        ...control,
      ];
    case "h265":
      return [
        "-c:v",
        "libx265",
        "-preset",
        "medium",
        "-x265-params",
        "log-level=error",
        // Apple's players only take HEVC tagged this way
        ...(format === "mp4" || format === "mov" ? ["-tag:v", "hvc1"] : []),
        ...control,
      ];
    case "vp9":
      return [
        "-c:v",
        "libvpx-vp9",
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        "-row-mt",
        "1",
        ...control,
        // constant quality needs the bitrate unset; a target needs it held to
        ...("crf" in rate ? ["-b:v", "0"] : ["-overshoot-pct", "0"]),
      ];
    case "av1":
      return ["-c:v", "libsvtav1", "-preset", "8", ...control];
  }
}

const audioEncoder = (format: VideoFormat) =>
  format === "webm" ? ("opus" as const) : ("aac" as const);

function encodeAudio(
  format: VideoFormat,
  channels: number,
  kbps: number,
): string[] {
  return [
    "-c:a",
    audioEncoder(format) === "opus" ? "libopus" : "aac",
    "-b:a",
    `${kbps}k`,
    // surround is downmixed, which also suits the bitrates here
    ...(channels > 2 ? ["-ac", "2"] : []),
  ];
}

/** Lays out the ffmpeg runs that turn `input` into `output`, or says why it can't be done. */
export function planVideo(
  info: VideoInfo,
  options: VideoOptions,
  {
    input,
    output,
    scratch,
  }: {
    input: string;
    output: string;
    /** Where pass logs and a GIF's palette go. */
    scratch: string;
  },
): VideoPlan {
  const { format, codec } = options;
  const gif = format === "gif";

  const available =
    info.duration === null ? null : info.duration - options.start;
  if (available !== null && available <= 0) {
    throw unusable(
      `start is past the end of the video, which is ${formatTimestamp(info.duration!)} long`,
    );
  }
  let length = options.end !== null ? options.end - options.start : available;
  if (length !== null && available !== null) {
    length = Math.min(length, available);
  }
  if (gif && length !== null && length > MAX_GIF_SECONDS + 0.05) {
    throw unusable(
      `A GIF can be at most ${MAX_GIF_SECONDS} seconds long, and this one would be ${formatTimestamp(length)}. Trim it with start and end`,
    );
  }

  // a GIF of unknown length still stops at the cap
  const limit = gif
    ? Math.min(length ?? MAX_GIF_SECONDS, MAX_GIF_SECONDS)
    : options.end !== null
      ? length
      : null;
  const inputArgs = [
    ...(options.start > 0 ? ["-ss", seconds(options.start)] : []),
    ...(limit !== null ? ["-t", seconds(limit)] : []),
    ...VIDEO_INPUT_GUARDS,
    "-i",
    `file:${input}`,
  ];
  // nothing about the original, such as where it was filmed, is carried over
  const strip = ["-map_metadata", "-1", "-map_chapters", "-1", "-sn", "-dn"];
  const writeOutput = [
    ...(format === "mp4" || format === "mov"
      ? ["-movflags", "+faststart"]
      : []),
    "-f",
    MUXERS[format],
    "-y",
    `file:${output}`,
  ];

  if (gif) {
    const size = outputSize(info, options.resolution);
    const filters = videoFilters(info, options, size, true);
    const { colors, dither } = GIF_PALETTES[options.quality];
    const palette = path.join(scratch, "palette.png");

    return {
      // the palette is worked out first, so frames needn't be held in memory for it
      passes: [
        {
          weight: 0.2,
          args: [
            ...inputArgs,
            "-filter_complex",
            `[0:V:0]${[...filters, `palettegen=max_colors=${colors}`].join(",")}[out]`,
            "-map",
            "[out]",
            "-frames:v",
            "1",
            "-update",
            "1",
            "-f",
            "image2",
            "-y",
            `file:${palette}`,
          ],
        },
        {
          weight: 0.8,
          args: [
            ...inputArgs,
            "-protocol_whitelist",
            "file",
            "-f",
            "png_pipe",
            "-i",
            `file:${palette}`,
            "-filter_complex",
            `[0:V:0]${filters.join(",") || "null"}[v];[v][1:v]paletteuse=${dither}[out]`,
            "-map",
            "[out]",
            ...strip,
            ...writeOutput,
          ],
        },
      ],
      ...size,
      duration: length,
      fit: null,
    };
  }

  const keepAudio = options.audio && info.audio !== null;
  const maps = ["-map", "0:V:0", ...(keepAudio ? ["-map", "0:a:0"] : [])];
  const channels = info.audio?.channels ?? 2;

  if (codec === "copy") {
    const copyable = COPYABLE[format];
    if (!copyable.video.includes(info.codec)) {
      throw unusable(
        `This video is ${CODEC_NAMES[info.codec] ?? info.codec}, which ${VIDEO_FORMAT_INFO[format].label} can't hold as it is. Choose a codec to convert it`,
      );
    }
    const audio = !keepAudio
      ? ["-an"]
      : copyable.audio.includes(info.audio!.codec)
        ? ["-c:a", "copy"]
        : encodeAudio(format, channels, AUDIO_KBPS[audioEncoder(format)].high);

    return {
      passes: [
        {
          weight: 1,
          args: [
            ...inputArgs,
            ...maps,
            "-c:v",
            "copy",
            ...(info.codec === "hevc" && (format === "mp4" || format === "mov")
              ? ["-tag:v", "hvc1"]
              : []),
            ...audio,
            ...strip,
            ...writeOutput,
          ],
        },
      ],
      // copied streams keep their pixels
      width: info.width,
      height: info.height,
      duration: length,
      fit: null,
    };
  }

  const encoded = codec as EncodedCodec;
  const size = outputSize(info, options.resolution);
  const filters = ["-vf", videoFilters(info, options, size, false).join(",")];

  if (options.targetSize === null) {
    const audio = keepAudio
      ? encodeAudio(
          format,
          channels,
          AUDIO_KBPS[audioEncoder(format)][options.quality],
        )
      : ["-an"];
    return {
      passes: [
        {
          weight: 1,
          args: [
            ...inputArgs,
            ...maps,
            ...filters,
            ...encoderArgs(encoded, format, {
              crf: CRF[encoded][options.quality],
            }),
            ...audio,
            ...strip,
            ...writeOutput,
          ],
        },
      ],
      ...size,
      duration: length,
      fit: null,
    };
  }

  // a size is met by spreading a bitrate over the length, measured in a first pass
  if (length === null) {
    throw unusable(
      "This video doesn't say how long it is, so it can't be fitted to a size. Choose a quality instead",
    );
  }
  const target = options.targetSize;
  const totalBps = (target * 8 * FIT_MARGIN) / length;
  const audioKbps = !keepAudio
    ? 0
    : (audioEncoder(format) === "aac" ? [128, 96, 64] : [96, 64, 48])[
        totalBps >= 1_000_000 ? 0 : totalBps >= 400_000 ? 1 : 2
      ];
  const videoBps = totalBps - audioKbps * 1000;
  if (videoBps < MIN_FIT_VIDEO_BPS) {
    throw unusable(
      `${formatBytes(target)} is too small for ${formatTimestamp(length)} of video. Choose a larger size, trim it, or choose a quality instead`,
    );
  }

  const passLog = path.join(scratch, "pass");
  const audio = keepAudio ? encodeAudio(format, channels, audioKbps) : ["-an"];
  const secondPass = (bitrate: number): VideoPass => ({
    weight: 0.6,
    args: [
      ...inputArgs,
      ...maps,
      ...filters,
      ...encoderArgs(encoded, format, { bitrate, pass: 2, passLog }),
      ...audio,
      ...strip,
      ...writeOutput,
    ],
  });

  return {
    passes: [
      {
        weight: 0.4,
        args: [
          ...inputArgs,
          "-map",
          "0:V:0",
          ...filters,
          ...encoderArgs(encoded, format, {
            bitrate: videoBps,
            pass: 1,
            passLog,
          }),
          "-an",
          "-f",
          "null",
          "-",
        ],
      },
      secondPass(videoBps),
    ],
    ...size,
    duration: length,
    // the first pass's measurements hold for any bitrate
    fit: {
      target,
      redo: (size) => secondPass(videoBps * (target / size) * 0.97),
    },
  };
}
