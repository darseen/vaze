import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ConversionError, FFPROBE, toConversionError } from "../conversion";

const execFileAsync = promisify(execFile);

// Inputs are untrusted uploads: read local files only, through mainstream
// demuxers, so playlists (HLS, concat) can't pull in other files or URLs.
export const VIDEO_INPUT_GUARDS = [
  "-protocol_whitelist",
  "file",
  "-format_whitelist",
  "mov,matroska,avi,flv,mpegts,mpeg,asf,ogg,gif",
];

// transfers that mark HDR video, such as an iPhone's HLG or HDR10's PQ
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);

export interface VideoInfo {
  /** ffprobe's name for the main video stream's codec, e.g. "h264". */
  codec: string;
  /** Frame size once turned upright, before non-square pixels are widened. */
  frameWidth: number;
  frameHeight: number;
  /** Size as it is shown: upright and with square pixels. */
  width: number;
  height: number;
  frameRate: number | null;
  /** HDR video is tone mapped, as every format here is converted to SDR. */
  hdr: boolean;
  audio: { codec: string; channels: number } | null;
  /** Absent for some files, e.g. WebM recorded in a browser. */
  duration: number | null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  sample_aspect_ratio?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  color_transfer?: string;
  channels?: number;
  disposition?: { attached_pic?: number };
  side_data_list?: { rotation?: number }[];
}

/** "30000/1001" as a number, or null for "0/0" and the like. */
function parseRatio(value: string | undefined): number | null {
  const [num, den] = (value ?? "").split(/[/:]/).map(Number);
  const ratio = num / den;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export async function probeVideo(
  input: string,
  signal: AbortSignal,
): Promise<VideoInfo> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      FFPROBE,
      [
        "-v",
        "error",
        ...VIDEO_INPUT_GUARDS,
        "-show_entries",
        "stream=codec_type,codec_name,width,height,sample_aspect_ratio,avg_frame_rate,r_frame_rate,color_transfer,channels:stream_disposition=attached_pic:stream_side_data=rotation:format=duration",
        "-of",
        "json",
        `file:${input}`,
      ],
      { signal, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
    ));
  } catch (error) {
    throw toConversionError(error, "This file isn't a video that can be read");
  }

  const info: { streams?: ProbeStream[]; format?: { duration?: string } } =
    JSON.parse(stdout);
  const streams = info.streams ?? [];

  // cover art comes as a video stream too
  const video = streams.find(
    (stream) =>
      stream.codec_type === "video" &&
      !stream.disposition?.attached_pic &&
      stream.width &&
      stream.height,
  );
  if (!video?.width || !video.height || !video.codec_name) {
    throw new ConversionError("This file has no video to convert", 422);
  }

  const rotation = video.side_data_list?.find(
    (data) => typeof data.rotation === "number",
  )?.rotation;
  const sideways = rotation !== undefined && Math.abs(rotation) % 180 === 90;
  const pixelAspect = parseRatio(video.sample_aspect_ratio) ?? 1;

  // ffmpeg turns frames upright before any filter sees them
  const frameWidth = sideways ? video.height : video.width;
  const frameHeight = sideways ? video.width : video.height;
  const storedWidth = Math.round(video.width * pixelAspect);

  const audio = streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(info.format?.duration);

  return {
    codec: video.codec_name,
    frameWidth,
    frameHeight,
    width: sideways ? video.height : storedWidth,
    height: sideways ? storedWidth : video.height,
    frameRate:
      parseRatio(video.avg_frame_rate) ?? parseRatio(video.r_frame_rate),
    hdr: HDR_TRANSFERS.has(video.color_transfer ?? ""),
    audio: audio?.codec_name
      ? { codec: audio.codec_name, channels: audio.channels ?? 2 }
      : null,
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
  };
}
