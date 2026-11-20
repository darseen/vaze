import type { ConversionSource } from "@/app/api/_utils/conversion";
import {
  toVideoName,
  VIDEO_CODEC_INFO,
  VIDEO_FORMAT_INFO,
} from "@/utils/conversion";
import type { VideoJob, VideoJobStatus } from "@repo/types";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ConversionError } from "../conversion";
import { createTurnQueue } from "../turn-queue";
import { FfmpegError, runFfmpeg } from "./ffmpeg";
import type { VideoOptions } from "./options";
import { planVideo, type VideoPass, type VideoPlan } from "./plan";
import type { VideoInfo } from "./probe";

/** How long a finished job and its result are kept for the caller to fetch. */
export const VIDEO_RESULT_TTL_MS = 60 * 60 * 1000;

interface JobRecord {
  id: string;
  ownerId: string;
  status: VideoJobStatus;
  progress: number | null;
  name: string;
  format: VideoJob["format"];
  codec: VideoJob["codec"];
  width: number;
  height: number;
  duration: number | null;
  size: number | null;
  sourceSize: number;
  error: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  /** Holds the upload, the scratch files and the result, and goes with the job. */
  workDir: string;
  output: string;
  controller: AbortController;
  expiry?: NodeJS.Timeout;
}

interface Registry {
  /** In the order they were started, which is the order they run in. */
  jobs: Map<string, JobRecord>;
  queue: ReturnType<typeof createTurnQueue>;
}

// Next runs this module once per bundle, so the routes share one registry
const shared = globalThis as typeof globalThis & {
  __vazeVideoJobs?: Registry;
};
// each encoder uses every core, so one video converts at a time
const registry = (shared.__vazeVideoJobs ??= {
  jobs: new Map(),
  queue: createTurnQueue({ maxRunning: 1, maxWaiting: 8 }),
});

export const isBusy = () => registry.queue.isBusy();

const removeWorkDir = (job: JobRecord) =>
  fs.rm(job.workDir, { recursive: true, force: true }).catch(() => {});

function position(job: JobRecord): number | null {
  if (job.status !== "queued") return null;
  let ahead = 0;
  for (const other of registry.jobs.values()) {
    if (other === job) break;
    if (other.status === "queued" || other.status === "converting") ahead++;
  }
  return ahead;
}

export function toVideoJob(job: JobRecord): VideoJob {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    position: position(job),
    name: job.name,
    format: job.format,
    codec: job.codec,
    mimeType: VIDEO_FORMAT_INFO[job.format].mimeType,
    width: job.width,
    height: job.height,
    duration: job.duration,
    size: job.size,
    sourceSize: job.sourceSize,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    expiresAt: job.expiresAt?.toISOString() ?? null,
  };
}

/** The caller's job, or null for one that is gone or someone else's. */
export function findVideoJob(id: string, ownerId: string): JobRecord | null {
  const job = registry.jobs.get(id);
  return job && job.ownerId === ownerId ? job : null;
}

/** Stops a job that hasn't finished, or removes the result of one that has. */
export function removeVideoJob(id: string, ownerId: string): boolean {
  const job = findVideoJob(id, ownerId);
  if (!job) return false;

  registry.jobs.delete(id);
  clearTimeout(job.expiry);
  // a running job removes its folder once ffmpeg has stopped
  if (job.status === "queued" || job.status === "converting") {
    job.controller.abort();
  } else {
    void removeWorkDir(job);
  }
  return true;
}

/** What the caller is told when ffmpeg gives up. */
function failureMessage(error: unknown, job: JobRecord): string {
  if (error instanceof ConversionError) return error.message;
  if (error instanceof FfmpegError) {
    if (/no space left on device/i.test(error.stderr)) {
      return "The server ran out of space while converting this video";
    }
    if (/unknown encoder|encoder not found/i.test(error.stderr)) {
      const codec = job.codec ? VIDEO_CODEC_INFO[job.codec].label : "GIF";
      return `This server's ffmpeg can't encode ${codec}. Choose another codec`;
    }
  }
  console.error("video conversion failed", error);
  return "This video couldn't be converted. It may be damaged, or use something ffmpeg can't read";
}

async function run(
  job: JobRecord,
  plan: VideoPlan,
  turn: Promise<(() => void) | null>,
  scratch: string,
) {
  const { signal } = job.controller;
  let release: (() => void) | null = null;

  try {
    release = await turn;
    // the queue was checked in the same tick the turn was asked for
    if (!release) throw new Error("video queue refused a job it had room for");
    job.status = "converting";
    job.progress = plan.duration ? 0 : null;

    let finished = 0;
    const runPass = async (pass: VideoPass) => {
      await runFfmpeg(pass.args, {
        cwd: scratch,
        signal,
        onTime: (seconds) => {
          if (!plan.duration) return;
          const done =
            finished + pass.weight * Math.min(seconds / plan.duration, 1);
          // never back, and short of the end until the result is checked
          job.progress = Math.max(job.progress ?? 0, Math.min(done, 0.99));
        },
      });
      finished += pass.weight;
    };

    for (const pass of plan.passes) await runPass(pass);

    let { size } = await fs.stat(job.output);
    if (plan.fit && size > plan.fit.target) {
      // a rare overshoot is fixed by a second try at the last pass
      const redo = plan.fit.redo(size);
      finished = 1 - redo.weight;
      await runPass(redo);
      ({ size } = await fs.stat(job.output));
    }

    job.status = "done";
    job.size = size;
    job.progress = 1;
    // only the result is kept from here on
    await Promise.all(
      ["upload", "work"].map((dir) =>
        fs.rm(path.join(job.workDir, dir), { recursive: true, force: true }),
      ),
    );
  } catch (error) {
    if (!signal.aborted) {
      job.status = "failed";
      job.error = failureMessage(error, job);
      void removeWorkDir(job);
    }
  } finally {
    release?.();
    if (signal.aborted) {
      void removeWorkDir(job);
    } else {
      job.expiresAt = new Date(Date.now() + VIDEO_RESULT_TTL_MS);
      job.expiry = setTimeout(() => {
        registry.jobs.delete(job.id);
        void removeWorkDir(job);
      }, VIDEO_RESULT_TTL_MS);
      job.expiry.unref();
    }
  }
}

/**
 * Plans the conversion and queues it, or returns null when the queue is full.
 * `workDir` becomes the job's, and goes with it; a stored file is linked into
 * it, so deleting the file meanwhile doesn't stop the conversion.
 */
export async function startVideoJob({
  ownerId,
  source,
  options,
  info,
  workDir,
}: {
  ownerId: string;
  source: ConversionSource;
  options: VideoOptions;
  info: VideoInfo;
  workDir: string;
}): Promise<VideoJob | null> {
  const uploadDir = path.join(workDir, "upload");
  const scratch = path.join(workDir, "work");
  const resultDir = path.join(workDir, "result");
  const output = path.join(
    resultDir,
    `video.${VIDEO_FORMAT_INFO[options.format].extension}`,
  );

  let input = source.path;
  const plan = (from: string) =>
    planVideo(info, options, { input: from, output, scratch });
  // refuses what can't be done before anything is set up
  plan(input);

  await Promise.all(
    [uploadDir, scratch, resultDir].map((dir) =>
      fs.mkdir(dir, { recursive: true }),
    ),
  );
  if (!source.path.startsWith(workDir + path.sep)) {
    const link = path.join(uploadDir, "source");
    // the uploads and staging share a volume, so this costs no space
    if (
      await fs.link(source.path, link).then(
        () => true,
        () => false,
      )
    ) {
      input = link;
    }
  }

  // checked and taken in one tick, so no other request can take the place
  if (registry.queue.isBusy()) return null;
  const controller = new AbortController();
  const turn = registry.queue.acquireTurn(controller.signal);

  const planned = plan(input);
  const job: JobRecord = {
    id: crypto.randomUUID(),
    ownerId,
    status: "queued",
    progress: null,
    name: toVideoName(source.name, options.format),
    format: options.format,
    codec: options.codec,
    width: planned.width,
    height: planned.height,
    duration: planned.duration,
    size: null,
    sourceSize: source.size,
    error: null,
    createdAt: new Date(),
    expiresAt: null,
    workDir,
    output,
    controller,
  };
  registry.jobs.set(job.id, job);
  void run(job, planned, turn, scratch);

  return toVideoJob(job);
}
