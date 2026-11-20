import { spawn } from "node:child_process";
import os from "node:os";
import type { Readable } from "node:stream";
import { FFMPEG, toConversionError } from "../conversion";

/** ffmpeg ran but exited with an error, which `stderr` explains. */
export class FfmpegError extends Error {
  constructor(
    readonly stderr: string,
    exit: number | string | null,
  ) {
    super(`ffmpeg exited with ${exit}: ${stderr}`);
    this.name = "FfmpegError";
  }
}

/** Runs ffmpeg with `args`, telling `onTime` how many seconds of the result it has made so far. */
export function runFfmpeg(
  args: string[],
  {
    cwd,
    signal,
    onTime,
  }: { cwd: string; signal: AbortSignal; onTime: (seconds: number) => void },
): Promise<void> {
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const proc = spawn(
      FFMPEG,
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostats",
        "-progress",
        "pipe:3",
        ...args,
      ],
      {
        cwd,
        stdio: ["ignore", "ignore", "pipe", "pipe"],
        // SVT-AV1 logs past ffmpeg's log level; 1 keeps only its errors
        env: { ...process.env, SVT_LOG: "1" },
      },
    );

    // encoding takes every core it can get, so requests are served first
    if (proc.pid !== undefined) {
      try {
        os.setPriority(proc.pid, 10);
      } catch {
        // it already exited, or the system won't allow it
      }
    }

    let stderr = "";
    proc.stderr!.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });

    let pending = "";
    (proc.stdio[3] as Readable).on("data", (chunk: Buffer) => {
      const lines = (pending + chunk.toString()).split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("out_time_us=")) continue;
        // "N/A" until the first frame is out
        const microseconds = Number(line.slice("out_time_us=".length));
        if (Number.isFinite(microseconds) && microseconds >= 0) {
          onTime(microseconds / 1_000_000);
        }
      }
    });

    const stop = () => proc.kill("SIGKILL");
    signal.addEventListener("abort", stop, { once: true });

    proc.once("error", (error) => {
      signal.removeEventListener("abort", stop);
      reject(toConversionError(error, "Failed to convert the video"));
    });
    proc.once("close", (code, exitSignal) => {
      signal.removeEventListener("abort", stop);
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(new FfmpegError(stderr.trim(), code ?? exitSignal));
    });
  });
}
