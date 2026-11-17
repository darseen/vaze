import type Vaze from "@darseen/vaze";
import type {
  File,
  FileReference,
  ImageConversionOptions,
  ImageFormat,
} from "@darseen/vaze";
import { fetch as streamingFetch } from "expo/fetch";
import { Directory, File as DeviceFile, Paths } from "expo-file-system";
import { extensionOf, previewKind } from "./file-kind";

// the server's constant bitrate, so the final size follows from the duration
const MP3_BITRATE_KBPS = 192;
// progress re-renders at most this often
const REPORT_MS = 150;

export type ConversionSource =
  | { kind: "device"; file: FileReference & { size: number } }
  | { kind: "vaze"; file: File };

export type ReadHeader = (name: string) => string | null;

type Handlers = {
  /** Only for device files, which are uploaded first. */
  onUploadProgress: (fraction: number) => void;
  /** `fraction` is null when the result's size isn't known. */
  onProgress: (received: number, fraction: number | null) => void;
  onDone: (result: DeviceFile, header: ReadHeader) => void;
  onError: (message: string) => void;
};

type ConversionRequest = {
  url: string;
  /** What the result is called in the app's cache. */
  name: string;
  /** Sent with the file, in the JSON body or as form fields. */
  options?: Record<string, string | number | undefined>;
  /** The result's size, for a response that streams without a length. */
  expectedSize?: (header: ReadHeader) => number | null;
};

export const toMp3Name = (name: string) =>
  `${name.replace(/\.[^./\\]+$/, "") || "audio"}.mp3`;

export const isVideo = (file: File) => previewKind(file) === "video";

/** What images convert to, in the order the app offers them. */
export const IMAGE_FORMATS: ImageFormat[] = ["webp", "jpeg", "png", "avif"];

export const IMAGE_FORMAT_INFO: Record<
  ImageFormat,
  { label: string; extension: string; mimeType: string; lossy: boolean }
> = {
  webp: {
    label: "WebP",
    extension: "webp",
    mimeType: "image/webp",
    lossy: true,
  },
  jpeg: { label: "JPG", extension: "jpg", mimeType: "image/jpeg", lossy: true },
  png: { label: "PNG", extension: "png", mimeType: "image/png", lossy: false },
  avif: {
    label: "AVIF",
    extension: "avif",
    mimeType: "image/avif",
    lossy: true,
  },
};

export const toImageName = (name: string, format: ImageFormat) =>
  `${name.replace(/\.[^./\\]+$/, "") || "image"}.${IMAGE_FORMAT_INFO[format].extension}`;

// what the server reads, HEIC photos included
const CONVERTIBLE_IMAGES = [
  "jpg",
  "jpeg",
  "jfif",
  "png",
  "webp",
  "avif",
  "gif",
  "tif",
  "tiff",
  "svg",
  "heic",
  "heif",
];

export const isConvertibleImage = (file: { name: string; mimeType: string }) =>
  CONVERTIBLE_IMAGES.includes(extensionOf(file.name)) ||
  /^image\/(jpeg|png|webp|avif|gif|tiff|svg\+xml|heic|heif)$/.test(
    file.mimeType,
  );

export type ConversionSupport = { video: boolean; image: boolean };

/** Which conversions a server offers, or null when it couldn't be asked. */
export async function supportedConversions(
  vaze: Vaze,
): Promise<ConversionSupport | null> {
  // the routes only take POST, so a server that has one answers 405, not 404
  const has = async (url: string) =>
    (await fetch(url, { credentials: "omit" })).status !== 404;
  try {
    const [video, image] = await Promise.all([
      has(vaze.conversion.videoToAudioUrl()),
      has(vaze.conversion.imageUrl()),
    ]);
    return { video, image };
  } catch {
    return null;
  }
}

function mp3Size(duration: string | null) {
  const seconds = Number(duration);
  return seconds > 0
    ? Math.ceil((seconds * MP3_BITRATE_KBPS * 1000) / 8)
    : null;
}

function expectedTotal(request: ConversionRequest, header: ReadHeader) {
  return (
    Number(header("Content-Length")) || request.expectedSize?.(header) || null
  );
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
    return "This server can't do this conversion yet. Update it to use it";
  }
  if (status === 401) return "Your session ended. Sign in again";
  return `Conversion failed (${status})`;
}

class Canceled extends Error {}

/** A stored file converts on the server and streams to disk as it comes. */
async function convertStored(
  vaze: Vaze,
  file: File,
  request: ConversionRequest,
  destination: DeviceFile,
  onProgress: Handlers["onProgress"],
  signal: AbortSignal,
): Promise<ReadHeader> {
  const response = await streamingFetch(request.url, {
    method: "POST",
    headers: {
      ...(await vaze.authHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId: file.id, ...request.options }),
    credentials: "omit",
    signal,
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(failureMessage(response.status, body));
  }

  const header: ReadHeader = (name) => response.headers.get(name);
  const report = reporter(onProgress, expectedTotal(request, header));
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
  return header;
}

/** A device file goes up through React Native's XHR, the one client that streams it from disk with upload progress. */
async function convertDevice(
  vaze: Vaze,
  file: FileReference,
  request: ConversionRequest,
  destination: DeviceFile,
  handlers: Handlers,
  signal: AbortSignal,
): Promise<ReadHeader> {
  const headers = await vaze.authHeaders();
  if (signal.aborted) throw new Canceled();

  const xhr = new XMLHttpRequest();
  xhr.open("POST", request.url);
  xhr.responseType = "arraybuffer";
  // cookies are sent by hand, so the native cookie jar must stay out of it
  xhr.withCredentials = false;
  for (const [name, value] of Object.entries(headers)) {
    xhr.setRequestHeader(name, value);
  }

  const header: ReadHeader = (name) => xhr.getResponseHeader(name);
  let report: ((received: number) => void) | null = null;
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XMLHttpRequest.HEADERS_RECEIVED) return;
    if (xhr.status !== 200) return;
    report = reporter(handlers.onProgress, expectedTotal(request, header));
  };
  xhr.upload.onprogress = (event) => {
    if (event.total > 0) handlers.onUploadProgress(event.loaded / event.total);
  };
  xhr.onprogress = (event) => report?.(event.loaded);

  const body = new FormData();
  for (const [name, value] of Object.entries(request.options ?? {})) {
    if (value !== undefined) body.append(name, String(value));
  }
  // the server only names its reply after the part, and the app names the result itself
  body.append("file", {
    uri: file.uri,
    name: file.name.replace(/[^\x20-\x7e]|"/g, "_"),
    type: file.type,
  } as unknown as Blob);

  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
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

  await destination.write(new Uint8Array(result));
  return header;
}

// one cache folder per conversion, so two of one name never collide
let conversionCount = 0;

/** Converts `source` into the app's cache; returns a function that cancels it. */
function convert(
  vaze: Vaze,
  source: ConversionSource,
  request: ConversionRequest,
  handlers: Handlers,
): () => void {
  const controller = new AbortController();
  const folder = new Directory(
    Paths.cache,
    "conversions",
    `${Date.now()}-${conversionCount++}`,
  );
  folder.create({ intermediates: true, idempotent: true });
  const destination = new DeviceFile(folder, request.name);

  const run =
    source.kind === "vaze"
      ? convertStored(
          vaze,
          source.file,
          request,
          destination,
          handlers.onProgress,
          controller.signal,
        )
      : convertDevice(
          vaze,
          source.file,
          request,
          destination,
          handlers,
          controller.signal,
        );

  run.then(
    (header) => {
      if (controller.signal.aborted) discardResult(destination);
      else handlers.onDone(destination, header);
    },
    (error: unknown) => {
      discardResult(destination);
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

/** Extracts a video's audio as an MP3. */
export function convertToAudio(
  vaze: Vaze,
  source: ConversionSource,
  handlers: Handlers,
) {
  return convert(
    vaze,
    source,
    {
      url: vaze.conversion.videoToAudioUrl(),
      name: toMp3Name(source.file.name),
      expectedSize: (header) => mp3Size(header("X-Content-Duration")),
    },
    handlers,
  );
}

/** Converts an image to another format, resized when asked. */
export function convertImage(
  vaze: Vaze,
  source: ConversionSource,
  options: ImageConversionOptions,
  handlers: Handlers,
) {
  return convert(
    vaze,
    source,
    {
      url: vaze.conversion.imageUrl(),
      name: toImageName(source.file.name, options.format),
      options,
    },
    handlers,
  );
}

/** Deletes earlier visits' results, kept until now in case a share is still reading one. */
export function clearConversions() {
  try {
    const folder = new Directory(Paths.cache, "conversions");
    if (folder.exists) folder.delete();
  } catch {
    // already gone
  }
}

function discardResult(result: DeviceFile) {
  try {
    result.parentDirectory.delete();
  } catch {
    // already gone
  }
}
