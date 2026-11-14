import { expectedMp3Bytes } from "@/utils/conversion";
import type { ApiResponse, FileWithUrl } from "@repo/types";

export type ConversionSource =
  { kind: "device"; file: File } | { kind: "vaze"; file: FileWithUrl };

interface Handlers {
  /** Only for device files, which are uploaded first. */
  onUploadProgress: (fraction: number) => void;
  /** `fraction` is null when the video doesn't declare its duration. */
  onProgress: (received: number, fraction: number | null) => void;
  onDone: (audio: Blob) => void;
  onError: (message: string) => void;
}

async function errorMessageOf(xhr: XMLHttpRequest): Promise<string> {
  try {
    const body: ApiResponse<unknown> = JSON.parse(
      await (xhr.response as Blob).text(),
    );
    if (body.error?.message) return body.error.message;
  } catch {
    // not a JSON error body, e.g. from a proxy in front of Vaze
  }
  return `Conversion failed (${xhr.status})`;
}

/** Starts converting `source` to MP3 and returns a function that cancels it. */
export function requestConversion(
  source: ConversionSource,
  handlers: Handlers,
): () => void {
  // XHR rather than fetch, which can't report upload progress
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/conversion/video-to-audio");
  xhr.responseType = "blob";

  let expectedSize: number | null = null;
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XMLHttpRequest.HEADERS_RECEIVED) return;
    const duration = Number(xhr.getResponseHeader("X-Content-Duration"));
    if (duration > 0) expectedSize = expectedMp3Bytes(duration);
  };

  xhr.onprogress = (event) => {
    if (xhr.status !== 200) return;
    // the estimate can be off by a few frames, so 100% waits for the end
    handlers.onProgress(
      event.loaded,
      expectedSize ? Math.min(event.loaded / expectedSize, 0.99) : null,
    );
  };

  xhr.onload = async () => {
    if (xhr.status === 200) handlers.onDone(xhr.response as Blob);
    else handlers.onError(await errorMessageOf(xhr));
  };
  xhr.onerror = () => handlers.onError("Network error, check your connection");

  if (source.kind === "device") {
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        handlers.onUploadProgress(event.loaded / event.total);
      }
    };
    const body = new FormData();
    body.append("file", source.file);
    xhr.send(body);
  } else {
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify({ fileId: source.file.id }));
  }

  return () => xhr.abort();
}
