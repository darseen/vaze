import { BASE_THUMBNAILS_PATH } from "@/constants";
import crypto from "node:crypto";
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// twice a card's preview area, so it stays sharp on high-density screens
const WIDTH = 640;
const HEIGHT = 320;

// sharp runs on libuv's thread pool (4 threads), which file I/O also needs
const MAX_CONCURRENT = 2;

let running = 0;
const waiting: (() => void)[] = [];
const inFlight = new Map<string, Promise<boolean>>();

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running < MAX_CONCURRENT) running++;
  else await new Promise<void>((resolve) => waiting.push(resolve));

  try {
    return await task();
  } finally {
    // hand the slot straight to the next job so nothing can jump the queue
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

export function thumbnailPath(id: string): string {
  return path.join(BASE_THUMBNAILS_PATH, `${id}.webp`);
}

/** Resolves false when sharp can't read the source as an image. */
async function render(source: string, target: string): Promise<boolean> {
  await fs.mkdir(BASE_THUMBNAILS_PATH, { recursive: true });
  const temp = `${target}.${crypto.randomUUID()}.tmp`;

  try {
    // `failOn: none` shows what a truncated image has, like a browser would
    await sharp(source, { autoOrient: true, failOn: "none" })
      .resize(WIDTH, HEIGHT, { withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(temp);
  } catch {
    await fs.rm(temp, { force: true });
    return false;
  }

  await fs.rename(temp, target);
  return true;
}

/** Rendered on first request and cached after; null if sharp can't read it. */
export async function getThumbnail(
  id: string,
  source: string,
): Promise<{ path: string; stats: Stats } | null> {
  const target = thumbnailPath(id);

  const cached = await fs.stat(target).catch(() => null);
  if (cached) return { path: target, stats: cached };

  let job = inFlight.get(id);
  if (!job) {
    job = withSlot(() => render(source, target)).finally(() =>
      inFlight.delete(id),
    );
    inFlight.set(id, job);
  }

  if (!(await job)) return null;
  return { path: target, stats: await fs.stat(target) };
}

/** Best effort: a leftover thumbnail only costs a few KB of disk. */
export async function removeThumbnails(ids: string[]) {
  await Promise.all(
    ids.map((id) => fs.rm(thumbnailPath(id), { force: true }).catch(() => {})),
  );
}
