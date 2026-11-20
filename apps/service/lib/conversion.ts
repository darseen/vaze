import { MP3_BITRATE_KBPS } from "@/utils/conversion";
import { execFile, spawn } from "node:child_process";
import os from "node:os";
import { PassThrough, Readable } from "node:stream";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// both ship in the image's ffmpeg package; set these for binaries off PATH
export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

// Inputs are untrusted uploads: read local files only, through mainstream
// demuxers, so playlists (HLS, concat) can't pull in other files or URLs.
const INPUT_GUARDS = [
  "-protocol_whitelist",
  "file",
  "-format_whitelist",
  "mov,matroska,avi,flv,mpegts,mpeg,asf,ogg,mp3,wav,flac,aac",
];

// each ffmpeg is its own process and encodes on a single core
const MAX_CONCURRENT = Math.max(2, Math.floor(os.availableParallelism() / 2));
let running = 0;

export class ConversionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConversionError";
    this.status = status;
  }
}

export const isBusy = () => running >= MAX_CONCURRENT;

/** Takes a conversion slot and returns its release, or null when all are taken. */
export function acquireSlot(): (() => void) | null {
  if (isBusy()) return null;
  running++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    running--;
  };
}

export function toConversionError(error: unknown, message: string): Error {
  if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") {
    return new ConversionError("ffmpeg is not installed on this server", 503);
  }
  if (error instanceof Error && error.name === "AbortError") return error;
  return new ConversionError(message, 422);
}

async function probe(input: string, signal: AbortSignal) {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      FFPROBE,
      [
        "-v",
        "error",
        ...INPUT_GUARDS,
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        `file:${input}`,
      ],
      { signal, timeout: 30_000, maxBuffer: 1024 * 1024 },
    ));
  } catch (error) {
    throw toConversionError(error, "This file isn't a video that can be read");
  }

  const info: {
    streams?: { codec_type?: string }[];
    format?: { duration?: string };
  } = JSON.parse(stdout);
  const duration = Number(info.format?.duration);

  return {
    hasAudio: info.streams?.some((s) => s.codec_type === "audio") ?? false,
    // absent for some files, e.g. WebM recorded in a browser
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
  };
}

/**
 * Extracts the audio of `input` as a stream of MP3 bytes. Resolves once the
 * first bytes are out, so a file that can't be converted still gets a JSON
 * error rather than a broken download. `onClose` runs once the stream is done
 * with, however it ends; ffmpeg is killed if the stream is canceled early.
 */
export async function convertToMp3(
  input: string,
  signal: AbortSignal,
  onClose: () => void,
): Promise<{ stream: ReadableStream<Uint8Array>; duration: number | null }> {
  const { hasAudio, duration } = await probe(input, signal);
  if (!hasAudio) {
    throw new ConversionError("This video has no audio track to convert", 422);
  }

  const proc = spawn(
    FFMPEG,
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      ...INPUT_GUARDS,
      "-i",
      `file:${input}`,
      "-vn",
      "-sn",
      "-dn",
      "-c:a",
      "libmp3lame",
      "-b:a",
      `${MP3_BITRATE_KBPS}k`,
      // a pipe has no extension to infer the container from
      "-f",
      "mp3",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stderr = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });

  let started = false;
  let killed = false;

  // ends only on exit code 0, so a crash mid-way can't pass for a complete file
  const output = new PassThrough();
  proc.stdout.pipe(output, { end: false });

  proc.once("error", (error) =>
    output.destroy(toConversionError(error, "Failed to convert file")),
  );
  proc.once("close", (code, exitSignal) => {
    if (code === 0) {
      output.end();
      return;
    }

    const error = new Error(
      `ffmpeg exited with ${code ?? exitSignal}: ${stderr.trim()}`,
    );
    // before the first byte the route reports it instead
    if (started && !killed) console.error("conversion failed mid-way", error);
    output.destroy(error);
  });

  const stop = () => {
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    killed = true;
    proc.kill("SIGKILL");
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();

  output.once("close", () => {
    signal.removeEventListener("abort", stop);
    stop();
    onClose();
  });

  await new Promise<void>((resolve, reject) => {
    proc.stdout.once("data", () => resolve());
    output.once("finish", resolve);
    output.once("error", reject);
  });
  started = true;

  return {
    stream: Readable.toWeb(output) as unknown as ReadableStream<Uint8Array>,
    duration,
  };
}
