import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";
import ffmpegPath from "ffmpeg-static";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { accessPath, toStoragePath } from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonError = (message: string, status: number) =>
  NextResponse.json({ error: { message }, data: null }, { status });

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:read",
    });
    if (authError) return jsonError(authError.message, authError.status);

    const body = await request.json().catch(() => null);
    const fileId = body?.fileId;
    if (!fileId) return jsonError("fileId is required", 400);

    const [file] = await db
      .select()
      .from(filesTable)
      .where(and(eq(filesTable.id, fileId), isNull(filesTable.deletedAt)));

    if (!file) return jsonError("File not found", 404);

    const sourcePath = path.resolve(toStoragePath(file.key));
    if (!(await accessPath(sourcePath))) {
      return jsonError("File not found", 404);
    }

    const audio = await startMp3Conversion(sourcePath, request.signal);

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": contentDisposition(toMp3Name(file.name)),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // ffmpeg's message when the input has no audio stream to extract
    if (
      error instanceof Error &&
      error.message.includes("does not contain any stream")
    ) {
      return jsonError("This file has no audio track to convert", 422);
    }

    console.error("File conversion error: ", error);
    return jsonError("Failed to convert file", 500);
  }
}

/**
 * Starts ffmpeg and resolves with a web stream of MP3 bytes as soon as the
 * first bytes are available. If ffmpeg fails before producing any output (bad
 * input, no audio track, unreadable file...) this rejects, so the route can still
 * answer with a normal JSON error instead of a broken download.
 */
async function startMp3Conversion(input: string, signal: AbortSignal) {
  if (!ffmpegPath) throw new Error("ffmpeg binary not found");

  const proc = spawn(
    ffmpegPath,
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      "-vn", // drop video
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-f",
      "mp3", // required when writing to a pipe (no extension to infer from)
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let stderr = "";
  proc.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });

  // Relay stdout through a PassThrough that only *ends* once ffmpeg exited with
  // code 0. Otherwise a crash mid-way looks like a finished (truncated) file.
  const output = new PassThrough();
  proc.stdout.pipe(output, { end: false });

  proc.once("error", (err) => output.destroy(err));
  proc.once("close", (code) => {
    if (code === 0) output.end();
    else
      output.destroy(
        new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`),
      );
  });

  // Stop transcoding as soon as nobody is listening (tab closed, fetch aborted).
  const stop = () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill("SIGKILL");
    }
  };
  signal.addEventListener("abort", stop, { once: true });
  output.once("close", () => {
    signal.removeEventListener("abort", stop);
    stop();
  });

  // Wait for the first bytes (or a failure) before committing to a 200.
  await new Promise<void>((resolve, reject) => {
    output.once("readable", resolve);
    output.once("error", reject);
  });

  return Readable.toWeb(output) as unknown as ReadableStream<Uint8Array>;
}

const toMp3Name = (name: string) =>
  `${name.replace(/\.[^./\\]+$/, "") || "audio"}.mp3`;

function contentDisposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
