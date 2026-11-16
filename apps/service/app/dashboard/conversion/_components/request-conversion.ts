import type { ApiResponse, FileWithUrl } from "@repo/types";

export type ConversionSource =
  { kind: "device"; file: File } | { kind: "vaze"; file: FileWithUrl };

type ReadHeader = (name: string) => string | null;

interface Conversion {
  url: string;
  source: ConversionSource;
  /** Sent with the file, in the JSON body or as form fields. */
  options?: Record<string, string | number>;
  /** The result's expected size, for responses that stream without a length. */
  expectedSize?: (header: ReadHeader) => number | null;
}

interface Handlers {
  /** Only for device files, which are uploaded first. */
  onUploadProgress: (fraction: number) => void;
  /** `fraction` is null when the result's size isn't known. */
  onProgress: (received: number, fraction: number | null) => void;
  onDone: (result: Blob, header: ReadHeader) => void;
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

/** Starts converting `source` and returns a function that cancels it. */
export function requestConversion(
  { url, source, options = {}, expectedSize }: Conversion,
  handlers: Handlers,
): () => void {
  // XHR rather than fetch, which can't report upload progress
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url);
  xhr.responseType = "blob";
  const header: ReadHeader = (name) => xhr.getResponseHeader(name);

  let expected: number | null = null;
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XMLHttpRequest.HEADERS_RECEIVED) return;
    expected = expectedSize?.(header) ?? null;
  };

  xhr.onprogress = (event) => {
    if (xhr.status !== 200) return;
    const total = event.lengthComputable ? event.total : expected;
    // an estimate can be off by a few frames, so 100% waits for the end
    handlers.onProgress(
      event.loaded,
      total ? Math.min(event.loaded / total, 0.99) : null,
    );
  };

  xhr.onload = async () => {
    if (xhr.status === 200) handlers.onDone(xhr.response as Blob, header);
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
    for (const [name, value] of Object.entries(options)) {
      body.append(name, String(value));
    }
    body.append("file", source.file);
    xhr.send(body);
  } else {
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify({ fileId: source.file.id, ...options }));
  }

  return () => xhr.abort();
}
