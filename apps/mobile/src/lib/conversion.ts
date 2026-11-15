import type Vaze from "@darseen/vaze";
import type { File, FileReference } from "@darseen/vaze";
import { fetch as streamingFetch } from "expo/fetch";
import { Directory, File as DeviceFile, Paths } from "expo-file-system";
import { previewKind } from "./file-kind";

// the server's constant bitrate, so the final size follows from the duration
const MP3_BITRATE_KBPS = 192;
// progress re-renders at most this often
const REPORT_MS = 150;

export type ConversionSource =
  | { kind: "device"; file: FileReference & { size: number } }
  | { kind: "vaze"; file: File };

type Handlers = {
  /** Only for device files, which are uploaded first. */
  onUploadProgress: (fraction: number) => void;
  /** `fraction` is null when the video doesn't declare its duration. */
  onProgress: (received: number, fraction: number | null) => void;
  onDone: (audio: DeviceFile) => void;
  onError: (message: string) => void;
};

export const toMp3Name = (name: string) =>
  `${name.replace(/\.[^./\\]+$/, "") || "audio"}.mp3`;

export const isVideo = (file: File) => previewKind(file) === "video";

/** Whether a server converts files, or null when it couldn't be asked. */
export async function supportsConversion(vaze: Vaze) {
  try {
    // the route only takes POST, so a server that has it answers 405, not 404
    const response = await fetch(vaze.conversion.videoToAudioUrl(), {
      credentials: "omit",
    });
    return response.status !== 404;
  } catch {
    return null;
  }
}

function expectedSize(duration: string | null) {
  const seconds = Number(duration);
  return seconds > 0
    ? Math.ceil((seconds * MP3_BITRATE_KBPS * 1000) / 8)
    : null;
}

function reporter(onProgress: Handlers["onProgress"], expected: number | null) {
  let last = 0;
  return (received: number) => {
    const now = Date.now();
    if (now - last < REPORT_MS) return;
    last = now;
    // the estimate can be off by a few frames, so 100% waits for the end
    onProgress(received, expected ? Math.min(received / expected, 0.99) : null);
  };
}

function failureMessage(status: number, body: string) {
  try {
    const { error } = JSON.parse(body) as { error?: { message?: string } };
    if (error?.message) return error.message;
  } catch {
    // not a JSON error body, e.g. an older server or a proxy in front of Vaze
  }
  if (status === 404) {
    return "This server can't convert files yet. Update it to use conversion";
  }
  if (status === 401) return "Your session ended. Sign in again";
  return `Conversion failed (${status})`;
}

class Canceled extends Error {}

/** A stored file converts on the server and streams to disk as it comes. */
async function convertStored(
  vaze: Vaze,
  file: File,
  destination: DeviceFile,
  onProgress: Handlers["onProgress"],
  signal: AbortSignal,
) {
  const response = await streamingFetch(vaze.conversion.videoToAudioUrl(), {
    method: "POST",
    headers: {
      ...(await vaze.authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId: file.id }),
    credentials: "omit",
    signal,
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(failureMessage(response.status, body));
  }

  const report = reporter(
    onProgress,
    expectedSize(response.headers.get("X-Content-Duration")),
  );
  const reader = response.body.getReader();
  const writer = destination.writableStream().getWriter();
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      received += value.byteLength;
      report(received);
    }
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => undefined);
    throw error;
  }
}

/** A device file goes up through React Native's XHR, the one client that streams it from disk with upload progress. */
async function convertDevice(
  vaze: Vaze,
  file: FileReference,
  destination: DeviceFile,
  handlers: Handlers,
  signal: AbortSignal,
) {
  const headers = await vaze.authHeaders();
  if (signal.aborted) throw new Canceled();

  const xhr = new XMLHttpRequest();
  xhr.open("POST", vaze.conversion.videoToAudioUrl());
  xhr.responseType = "arraybuffer";
  // cookies are sent by hand, so the native cookie jar must stay out of it
  xhr.withCredentials = false;
  for (const [name, value] of Object.entries(headers)) {
    xhr.setRequestHeader(name, value);
  }

  let report: ((received: number) => void) | null = null;
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XMLHttpRequest.HEADERS_RECEIVED) return;
    if (xhr.status !== 200) return;
    report = reporter(
      handlers.onProgress,
      expectedSize(xhr.getResponseHeader("X-Content-Duration")),
    );
  };
  xhr.upload.onprogress = (event) => {
    if (event.total > 0) handlers.onUploadProgress(event.loaded / event.total);
  };
  xhr.onprogress = (event) => report?.(event.loaded);

  const body = new FormData();
  // the server only names its reply after the part, and the app names the MP3 itself
  body.append("file", {
    uri: file.uri,
    name: file.name.replace(/[^\x20-\x7e]|"/g, "_"),
    type: file.type,
  } as unknown as Blob);

  const audio = await new Promise<ArrayBuffer>((resolve, reject) => {
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort);
    const settle = () => signal.removeEventListener("abort", abort);

    xhr.onload = () => {
      settle();
      const bytes = xhr.response as ArrayBuffer | null;
      if (xhr.status === 200 && bytes) return resolve(bytes);
      const text = bytes ? new TextDecoder().decode(bytes) : "";
      reject(new Error(failureMessage(xhr.status, text)));
    };
    xhr.onerror = () => {
      settle();
      reject(new Error("Network error, check your connection"));
    };
    xhr.onabort = () => {
      settle();
      reject(new Canceled());
    };
    xhr.send(body);
  });

  destination.write(new Uint8Array(audio));
}

// one cache folder per conversion, so two of one name never collide
let conversionCount = 0;

/** Converts `source` to an MP3 in the app's cache; returns a function that cancels it. */
export function convertToAudio(
  vaze: Vaze,
  source: ConversionSource,
  handlers: Handlers,
): () => void {
  const controller = new AbortController();
  const folder = new Directory(
    Paths.cache,
    "conversions",
    `${Date.now()}-${conversionCount++}`,
  );
  folder.create({ intermediates: true, idempotent: true });
  const destination = new DeviceFile(folder, toMp3Name(source.file.name));

  const run =
    source.kind === "vaze"
      ? convertStored(
          vaze,
          source.file,
          destination,
          handlers.onProgress,
          controller.signal,
        )
      : convertDevice(
          vaze,
          source.file,
          destination,
          handlers,
          controller.signal,
        );

  run.then(
    () => {
      if (controller.signal.aborted) discardAudio(destination);
      else handlers.onDone(destination);
    },
    (error: unknown) => {
      discardAudio(destination);
      if (controller.signal.aborted || error instanceof Canceled) return;
      handlers.onError(
        error instanceof Error && error.message
          ? error.message
          : "Conversion failed",
      );
    },
  );

  return () => controller.abort();
}

/** Deletes earlier visits' MP3s, kept until now in case a share is still reading one. */
export function clearConversions() {
  try {
    const folder = new Directory(Paths.cache, "conversions");
    if (folder.exists) folder.delete();
  } catch {
    // already gone
  }
}

function discardAudio(audio: DeviceFile) {
  try {
    audio.parentDirectory.delete();
  } catch {
    // already gone
  }
}
