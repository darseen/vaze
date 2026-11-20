import type Vaze from "@darseen/vaze";
import type {
  ApiResponse,
  File,
  FileReference,
  ImageConversionOptions,
  ImageFormat,
  VideoCodec,
  VideoConversionOptions,
  VideoFormat,
  VideoJob,
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

export type Handlers = {
  /** Only for device files, which are uploaded first. */
  onUploadProgress: (fraction: number) => void;
  /** `fraction` is null when the result's size isn't known. */
  onProgress: (received: number, fraction: number | null) => void;
  onDone: (result: DeviceFile, header: ReadHeader) => void;
  onError: (message: string) => void;
};

export type ConversionRequest = {
  url: string;
  /** What the result is called in the app's cache. */
  name: string;
  /** Sent with the files, in the JSON body or as form fields, where lists go as JSON. */
  options?: Record<string, string | number | boolean | object | undefined>;
  /** Sends stored files as `fileIds`, for endpoints that take several. */
  many?: boolean;
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

/** What videos convert to, in the order the app offers them. */
export const VIDEO_FORMATS: VideoFormat[] = [
  "mp4",
  "webm",
  "mov",
  "mkv",
  "gif",
];

export const VIDEO_FORMAT_INFO: Record<
  VideoFormat,
  {
    label: string;
    mimeType: string;
    /** The codecs it holds, its default first; a GIF has none to pick. */
    codecs: VideoCodec[];
  }
> = {
  mp4: {
    label: "MP4",
    mimeType: "video/mp4",
    codecs: ["h264", "h265", "av1", "copy"],
  },
  webm: {
    label: "WebM",
    mimeType: "video/webm",
    codecs: ["vp9", "av1", "copy"],
  },
  mov: {
    label: "MOV",
    mimeType: "video/quicktime",
    codecs: ["h264", "h265", "copy"],
  },
  mkv: {
    label: "MKV",
    mimeType: "video/x-matroska",
    codecs: ["h264", "h265", "vp9", "av1", "copy"],
  },
  gif: { label: "GIF", mimeType: "image/gif", codecs: [] },
};

export const VIDEO_CODEC_INFO: Record<
  VideoCodec,
  { label: string; hint: string }
> = {
  h264: { label: "H.264", hint: "Plays on every device and site" },
  h265: { label: "H.265", hint: "Smaller, for phones and newer devices" },
  vp9: { label: "VP9", hint: "Plays in every browser" },
  av1: { label: "AV1", hint: "Smallest, slower to make, for newer devices" },
  copy: {
    label: "Keep",
    hint: "Keeps the video as it is and changes only the container, in seconds and without loss",
  },
};

/** Short sides offered, e.g. 720 for 1280 × 720 or 720 × 1280. */
export const VIDEO_RESOLUTIONS = [2160, 1440, 1080, 720, 480, 360, 240];

/** Frame rates offered as a cap; a video slower than the cap keeps its own. */
export const VIDEO_FRAME_RATES = [60, 30, 24, 15, 10];

/** What a GIF gets unless asked otherwise, as the server does. */
export const GIF_RESOLUTION = 480;
export const GIF_FRAME_RATE = 15;

/** The smallest target size the server takes. */
export const MIN_VIDEO_TARGET_SIZE = 100 * 1024;

/** Whether the server can convert `file` as a video, animated GIFs included. */
export const isConvertibleVideo = (file: File) =>
  isVideo(file) ||
  file.mimeType === "image/gif" ||
  extensionOf(file.name) === "gif";

/** Reads seconds such as "90" or a time such as "1:30" or "1:02:03.5"; null if it's neither. */
export function parseTimestamp(value: string): number | null {
  const match = /^\s*(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;

  const [, first, second, rest] = match;
  const hours = second !== undefined ? Number(first) : 0;
  const minutes = second !== undefined ? Number(second) : Number(first ?? 0);
  const seconds = Number(rest);
  // a unit below another runs to 59
  if (
    (first !== undefined && seconds >= 60) ||
    (second !== undefined && minutes >= 60)
  ) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

/** e.g. "0:07", "12:30" or "1:02:03". */
export function formatTimestamp(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** How a result's size compares with the original's. */
export function sizeChange(size: number, sourceSize: number): string | null {
  if (!sourceSize) return null;
  const ratio = size / sourceSize;
  // e.g. a small SVG drawn large, where a percentage runs to thousands
  if (ratio >= 2) {
    return `${parseFloat(ratio.toFixed(ratio < 10 ? 1 : 0))}× larger`;
  }
  const percent = Math.round((1 - ratio) * 100);
  if (percent > 0) return `${percent}% smaller`;
  if (percent < 0) return `${-percent}% larger`;
  return null;
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

const formValue = (value: string | number | boolean | object) =>
  typeof value === "object" ? JSON.stringify(value) : String(value);

/** Writes a response body to `destination` as it arrives. */
async function streamToFile(
  body: ReadableStream<Uint8Array>,
  destination: DeviceFile,
  report: (received: number) => void,
) {
  const reader = body.getReader();
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

/** Stored files convert on the server and the result streams to disk as it comes. */
async function convertStored(
  vaze: Vaze,
  files: File[],
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
    body: JSON.stringify({
      ...(request.many
        ? { fileIds: files.map((file) => file.id) }
        : { fileId: files[0].id }),
      ...request.options,
    }),
    credentials: "omit",
    signal,
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(failureMessage(response.status, body));
  }

  const header: ReadHeader = (name) => response.headers.get(name);
  await streamToFile(
    response.body,
    destination,
    reporter(onProgress, expectedTotal(request, header)),
  );
  return header;
}

/** The options as fields, then stored files by id and device files as parts, in order. */
function formOf(
  sources: ConversionSource[],
  options: ConversionRequest["options"] = {},
) {
  const body = new FormData();
  for (const [name, value] of Object.entries(options)) {
    if (value !== undefined) body.append(name, formValue(value));
  }
  for (const source of sources) {
    if (source.kind === "vaze") {
      body.append("fileId", source.file.id);
      continue;
    }
    // the server only names its reply after the part, and the app names the result itself
    body.append("file", {
      uri: source.file.uri,
      name: source.file.name.replace(/[^\x20-\x7e]|"/g, "_"),
      type: source.file.type,
    } as unknown as Blob);
  }
  return body;
}

/**
 * Device files go up through React Native's XHR, the one client that streams
 * them from disk with upload progress. Resolves with the status and the body
 * once it has all come back.
 */
async function sendForm(
  vaze: Vaze,
  url: string,
  body: FormData,
  {
    onUploadProgress,
    onHeaders,
    onDownloadProgress,
  }: {
    onUploadProgress: (fraction: number) => void;
    onHeaders?: (status: number, header: ReadHeader) => void;
    onDownloadProgress?: (received: number) => void;
  },
  signal: AbortSignal,
): Promise<{ status: number; bytes: ArrayBuffer | null; header: ReadHeader }> {
  const headers = await vaze.authHeaders();
  if (signal.aborted) throw new Canceled();

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url);
  xhr.responseType = "arraybuffer";
  // cookies are sent by hand, so the native cookie jar must stay out of it
  xhr.withCredentials = false;
  for (const [name, value] of Object.entries(headers)) {
    xhr.setRequestHeader(name, value);
  }

  const header: ReadHeader = (name) => xhr.getResponseHeader(name);
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
      onHeaders?.(xhr.status, header);
    }
  };
  xhr.upload.onprogress = (event) => {
    if (event.total > 0) onUploadProgress(event.loaded / event.total);
  };
  xhr.onprogress = (event) => onDownloadProgress?.(event.loaded);

  return await new Promise((resolve, reject) => {
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort);
    const settle = () => signal.removeEventListener("abort", abort);

    xhr.onload = () => {
      settle();
      resolve({
        status: xhr.status,
        bytes: xhr.response as ArrayBuffer | null,
        header,
      });
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
}

const textOf = (bytes: ArrayBuffer | null) =>
  bytes ? new TextDecoder().decode(bytes) : "";

/** Device files, with any stored ones among them by id; the result comes back whole. */
async function convertDevice(
  vaze: Vaze,
  sources: ConversionSource[],
  request: ConversionRequest,
  destination: DeviceFile,
  handlers: Handlers,
  signal: AbortSignal,
): Promise<ReadHeader> {
  let report: ((received: number) => void) | null = null;
  const { status, bytes, header } = await sendForm(
    vaze,
    request.url,
    formOf(sources, request.options),
    {
      onUploadProgress: handlers.onUploadProgress,
      onHeaders: (status, header) => {
        if (status !== 200) return;
        report = reporter(handlers.onProgress, expectedTotal(request, header));
      },
      onDownloadProgress: (received) => report?.(received),
    },
    signal,
  );
  if (status !== 200 || !bytes) {
    throw new Error(failureMessage(status, textOf(bytes)));
  }

  await destination.write(new Uint8Array(bytes));
  return header;
}

// one cache folder per conversion, so two of one name never collide
let conversionCount = 0;

/** Where a result named `name` goes in the app's cache. */
function resultFile(name: string) {
  const folder = new Directory(
    Paths.cache,
    "conversions",
    `${Date.now()}-${conversionCount++}`,
  );
  folder.create({ intermediates: true, idempotent: true });
  return new DeviceFile(folder, name);
}

/** Converts `sources`, in order, into the app's cache; returns a function that cancels it. */
export function convert(
  vaze: Vaze,
  sources: ConversionSource[],
  request: ConversionRequest,
  handlers: Handlers,
): () => void {
  const controller = new AbortController();
  const destination = resultFile(request.name);

  const stored = sources.flatMap((source) =>
    source.kind === "vaze" ? [source.file] : [],
  );
  const run =
    stored.length === sources.length
      ? convertStored(
          vaze,
          stored,
          request,
          destination,
          handlers.onProgress,
          controller.signal,
        )
      : convertDevice(
          vaze,
          sources,
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
    [source],
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
    [source],
    {
      url: vaze.conversion.imageUrl(),
      name: toImageName(source.file.name, options.format),
      options,
    },
    handlers,
  );
}

export type VideoHandlers = {
  /** Only for device videos, which are uploaded first. */
  onUploadProgress: (fraction: number) => void;
  /** Once sent, while the server reads the video and queues it. */
  onStarting: () => void;
  /** The job as the server last reported it, while it waits or converts. */
  onJob: (job: VideoJob) => void;
  /** `fraction` is null when the server doesn't say how large the result is. */
  onDownloadProgress: (fraction: number | null) => void;
  onDone: (result: DeviceFile, job: VideoJob) => void;
  onError: (message: string) => void;
};

const POLL_MS = 1000;
// polls that may fail in a row, e.g. while the network drops, before giving up
const MAX_POLL_FAILURES = 10;

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Canceled());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(new Canceled());
    };
    signal.addEventListener("abort", stop, { once: true });
  });

/** Starts a device video's job, uploading it with progress. */
async function startDeviceVideo(
  vaze: Vaze,
  source: ConversionSource,
  options: VideoConversionOptions,
  handlers: VideoHandlers,
  signal: AbortSignal,
): Promise<ApiResponse<VideoJob>> {
  const { status, bytes } = await sendForm(
    vaze,
    vaze.conversion.videoUrl(),
    formOf([source], options),
    {
      onUploadProgress: (fraction) => {
        if (fraction < 1) handlers.onUploadProgress(fraction);
        else handlers.onStarting();
      },
    },
    signal,
  );
  const text = textOf(bytes);
  if (status !== 202) {
    return {
      data: null,
      error: { message: failureMessage(status, text), status },
    };
  }
  try {
    return JSON.parse(text) as ApiResponse<VideoJob>;
  } catch {
    return {
      data: null,
      error: { message: "The server's answer couldn't be read" },
    };
  }
}

/**
 * Converts a video on the server as a job: starts it, follows it, streams the
 * result into the app's cache and then removes it from the server. Returns a
 * function that cancels it, which stops the job on the server too.
 */
export function convertVideo(
  vaze: Vaze,
  source: ConversionSource,
  options: VideoConversionOptions,
  handlers: VideoHandlers,
): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  // the job to stop or remove on the server, once there is one
  let jobId: string | null = null;
  const release = () => {
    if (jobId) void vaze.conversion.cancelVideo(jobId);
    jobId = null;
  };

  async function run() {
    if (source.kind === "vaze") handlers.onStarting();
    const started =
      source.kind === "vaze"
        ? await vaze.conversion.startVideo({ id: source.file.id }, options)
        : await startDeviceVideo(vaze, source, options, handlers, signal);
    if (started.data) jobId = started.data.id;
    if (signal.aborted) throw new Canceled();
    if (started.error) throw new Error(started.error.message);

    let job = started.data;
    handlers.onJob(job);
    let failures = 0;
    while (job.status === "queued" || job.status === "converting") {
      await pause(POLL_MS, signal);
      const polled = await vaze.conversion.videoJob(job.id);
      if (signal.aborted) throw new Canceled();
      if (polled.error) {
        // one without a status never reached the server
        if (polled.error.status !== undefined) {
          throw new Error(polled.error.message);
        }
        if (++failures >= MAX_POLL_FAILURES) {
          throw new Error(
            "Lost touch with the server. Check your connection and try again",
          );
        }
        continue;
      }
      failures = 0;
      job = polled.data;
      handlers.onJob(job);
    }
    if (job.status === "failed") {
      throw new Error(job.error ?? "This video couldn't be converted");
    }

    handlers.onDownloadProgress(job.size ? 0 : null);
    const destination = resultFile(job.name);
    try {
      const response = await streamingFetch(
        vaze.conversion.videoDownloadUrl(job.id),
        { headers: await vaze.authHeaders(), credentials: "omit", signal },
      );
      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => "");
        throw new Error(failureMessage(response.status, body));
      }
      const expected =
        Number(response.headers.get("Content-Length")) || job.size;
      await streamToFile(
        response.body,
        destination,
        reporter(
          (_received, fraction) => handlers.onDownloadProgress(fraction),
          expected,
        ),
      );
    } catch (error) {
      discardResult(destination);
      throw error;
    }
    if (signal.aborted) {
      discardResult(destination);
      throw new Canceled();
    }
    // the video is on the phone, so the server's copy can go
    release();
    handlers.onDone(destination, job);
  }

  run().catch((error: unknown) => {
    release();
    if (signal.aborted || error instanceof Canceled) return;
    handlers.onError(
      error instanceof Error && error.message
        ? error.message
        : "This video couldn't be converted",
    );
  });

  return () => {
    controller.abort();
    release();
  };
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
