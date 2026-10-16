import type { File } from "@darseen/vaze";
import { Directory, File as DeviceFile, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import FilePreviews from "../../modules/file-previews";

type Source = { serverId: string; headers: Record<string, string> };

export type VideoPoster = { uri: string; duration: number };

// a cover only needs the first page, but PdfRenderer reads whole files
export const PDF_COVER_MAX_BYTES = 20 * 1024 * 1024;

// more than the few lines a card has room for
const TEXT_PREVIEW_BYTES = 2048;

// a cover is about a card wide, at a phone's pixel density
const COVER_WIDTH = 640;

// frame grabs and downloads share the network with the list's thumbnails
const MAX_JOBS = 2;

class Cancelled extends Error {}

const folderOf = (serverId: string) => {
  const folder = new Directory(Paths.cache, "previews", serverId);
  folder.create({ intermediates: true, idempotent: true });
  return folder;
};

function native() {
  if (!FilePreviews) throw new Error("Previews need a rebuilt app");
  return FilePreviews;
}

type Waiting = {
  wanted: () => boolean;
  start: () => void;
  skip: () => void;
};

const waiting: Waiting[] = [];
let running = 0;

function pump() {
  while (running < MAX_JOBS && waiting.length > 0) {
    const next = waiting.shift()!;
    if (!next.wanted()) {
      next.skip();
      continue;
    }
    running++;
    next.start();
  }
}

function enqueue<T>(task: () => Promise<T>, wanted: () => boolean) {
  return new Promise<T>((resolve, reject) => {
    waiting.push({
      wanted,
      skip: () => reject(new Cancelled()),
      start: () =>
        task()
          .then(resolve, reject)
          .finally(() => {
            running--;
            pump();
          }),
    });
    pump();
  });
}

type Shared = { promise: Promise<unknown>; demand: number };

const results = new Map<string, unknown>();
const failures = new Set<string>();
const shared = new Map<string, Shared>();

export type PreviewState<T> =
  { status: "loading" } | { status: "loaded"; value: T } | { status: "failed" };

function stateOf<T>(key: string | null): PreviewState<T> {
  if (key === null) return { status: "failed" };
  if (results.has(key))
    return { status: "loaded", value: results.get(key) as T };
  if (failures.has(key)) return { status: "failed" };
  return { status: "loading" };
}

/** Runs `produce` once per key on the shared queue, skipping jobs nobody waits for. */
export function usePreview<T>(
  key: string | null,
  produce: () => Promise<T>,
): PreviewState<T> {
  const [state, setState] = useState(() => stateOf<T>(key));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const current = stateOf<T>(key);
    setState(current);
    if (key === null || current.status !== "loading") return;

    let entry = shared.get(key);
    if (entry) {
      entry.demand++;
    } else {
      // counted before queueing, or a free slot would find nobody waiting
      const created: Shared = { demand: 1, promise: Promise.resolve() };
      created.promise = enqueue(produce, () => created.demand > 0)
        .then(
          (value) => {
            results.set(key, value);
            return value;
          },
          (error: unknown) => {
            if (!(error instanceof Cancelled)) failures.add(key);
            throw error;
          },
        )
        .finally(() => shared.delete(key));
      shared.set(key, created);
      entry = created;
    }

    let active = true;
    entry.promise.then(
      (value) => {
        if (active) setState({ status: "loaded", value: value as T });
      },
      (error: unknown) => {
        if (!active) return;
        // dropped just as this screen asked for it, so ask again
        if (error instanceof Cancelled) setAttempt((count) => count + 1);
        else setState({ status: "failed" });
      },
    );

    const claimed = entry;
    return () => {
      active = false;
      claimed.demand--;
    };
    // `produce` follows from the key, so a new closure needs no new job
  }, [key, attempt]);

  return state;
}

/** An early frame of a video and its length, kept on disk between launches. */
export async function videoPoster(
  { serverId, headers }: Source,
  file: File,
): Promise<VideoPoster> {
  const folder = folderOf(serverId);
  const image = new DeviceFile(folder, `${file.id}.frame.jpg`);
  const meta = new DeviceFile(folder, `${file.id}.frame.json`);

  if (image.exists && meta.exists) {
    const { duration } = JSON.parse(await meta.text()) as { duration: number };
    return { uri: image.uri, duration };
  }

  const frame = await native().videoFrame(file.url, headers, image.uri);
  meta.write(JSON.stringify({ duration: frame.duration }));
  return { uri: image.uri, duration: frame.duration };
}

const downloads = new Map<string, Promise<string>>();

/** The PDF itself on disk, which both the cover and the viewer read. */
export function pdfDocument(
  { serverId, headers }: Source,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const key = `${serverId}:${file.id}`;
  const pending = downloads.get(key);
  if (pending) return pending;

  const folder = folderOf(serverId);
  const target = new DeviceFile(folder, `${file.id}.pdf`);
  if (target.exists) return Promise.resolve(target.uri);

  // downloaded aside, so an interrupted download is never mistaken for the file
  const partial = new DeviceFile(folder, `${file.id}.pdf.part`);
  const download = DeviceFile.downloadFileAsync(file.url, partial, {
    headers,
    idempotent: true,
    onProgress: onProgress
      ? ({ bytesWritten, totalBytes }) =>
          onProgress(totalBytes > 0 ? bytesWritten / totalBytes : 0)
      : undefined,
  })
    .then(async (downloaded) => {
      await downloaded.move(target);
      return target.uri;
    })
    .finally(() => downloads.delete(key));

  downloads.set(key, download);
  return download;
}

/** The first page of a PDF, rendered about a card wide. */
export async function pdfCover(source: Source, file: File): Promise<string> {
  const cover = new DeviceFile(
    folderOf(source.serverId),
    `${file.id}.cover.jpg`,
  );
  if (cover.exists) return cover.uri;
  if (file.size > PDF_COVER_MAX_BYTES) throw new Error("Too large for a cover");

  const document = await pdfDocument(source, file);
  await native().pdfPage(document, 0, COVER_WIDTH, cover.uri);
  return cover.uri;
}

/** One page of a downloaded PDF at `width` pixels, cached on disk. */
export async function pdfPageImage(
  serverId: string,
  file: File,
  document: string,
  index: number,
  width: number,
): Promise<string> {
  const page = new DeviceFile(
    folderOf(serverId),
    `${file.id}.page-${index}-${width}.jpg`,
  );
  if (!page.exists) await native().pdfPage(document, index, width, page.uri);
  return page.uri;
}

export function pdfInfo(document: string) {
  return native().pdfInfo(document);
}

/** The start of a text file, or an error when it looks binary. */
export async function textStart(
  { headers }: Source,
  file: File,
  bytes = TEXT_PREVIEW_BYTES,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(file.url, {
    headers: { ...headers, Range: `bytes=0-${bytes - 1}` },
    signal,
  });
  if (!response.ok) throw new Error(`Unexpected ${response.status}`);

  const buffer = await response.arrayBuffer();
  // `stream` holds back a multi-byte character the range cut in half
  const text = new TextDecoder().decode(
    new Uint8Array(buffer.slice(0, bytes)),
    {
      stream: true,
    },
  );
  if (text.includes("\0")) throw new Error("Binary content");
  return text;
}
