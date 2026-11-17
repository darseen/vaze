import { BASE_HOSTED_IMAGES_PATH, BASE_TMP_PATH } from "@/constants";
import { IMAGE_FORMAT_INFO, type ImageFormat } from "@/utils/conversion";
import crypto from "node:crypto";
import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { ConversionError } from "./conversion";
import { acquireTurn, convertImage } from "./image-conversion";

/** One cached copy of a file: its width, or null for the image's own size, and format. */
export interface ImageVariant {
  width: number | null;
  format: ImageFormat;
}

export interface CachedImage {
  path: string;
  stats: Stats;
}

// a render outlives the request that started it, since the copy is kept either way
const NEVER = new AbortController().signal;

const inFlight = new Map<string, Promise<void>>();

/** The copy's file name, e.g. `w800.webp`, which also tells copies' ETags apart. */
export function variantName({ width, format }: ImageVariant): string {
  const { extension } = IMAGE_FORMAT_INFO[format];
  return `${width === null ? "full" : `w${width}`}.${extension}`;
}

function variantPath(id: string, variant: ImageVariant): string {
  return path.join(BASE_HOSTED_IMAGES_PATH, id, variantName(variant));
}

/** The copy already on disk, or null when it has yet to be rendered. */
export async function findCachedImage(
  id: string,
  variant: ImageVariant,
): Promise<CachedImage | null> {
  const target = variantPath(id, variant);
  const stats = await fs.stat(target).catch(() => null);
  return stats ? { path: target, stats } : null;
}

async function render(source: string, target: string, variant: ImageVariant) {
  const release = await acquireTurn(NEVER);
  if (!release) {
    throw new ConversionError(
      "The server is busy converting other files, try again soon",
      503,
    );
  }

  // holds a decoded HEIC while the copy renders
  const workDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
  const temp = `${target}.${crypto.randomUUID()}.tmp`;

  try {
    // a request that missed the cache just before the last render finished
    if (await fs.stat(target).catch(() => null)) return;

    const { data } = await convertImage(
      source,
      {
        format: variant.format,
        quality: null,
        width: variant.width,
        height: null,
      },
      { signal: NEVER, workDir },
    );

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(temp, data);
    await fs.rename(temp, target);
  } finally {
    release();
    await fs.rm(temp, { force: true }).catch(() => {});
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Renders the copy once, however many requests ask for it at the same time.
 * Throws a ConversionError when the image can't be read or the queue is full.
 */
export async function renderImage(
  id: string,
  source: string,
  variant: ImageVariant,
): Promise<CachedImage> {
  const target = variantPath(id, variant);

  let job = inFlight.get(target);
  if (!job) {
    job = render(source, target, variant).finally(() =>
      inFlight.delete(target),
    );
    inFlight.set(target, job);
  }

  await job;
  return { path: target, stats: await fs.stat(target) };
}

/** Best effort, like thumbnails: a leftover copy only costs disk. */
export async function removeHostedImages(ids: string[]) {
  await Promise.all(
    ids.map((id) =>
      fs
        .rm(path.join(BASE_HOSTED_IMAGES_PATH, id), {
          recursive: true,
          force: true,
        })
        .catch(() => {}),
    ),
  );
}
