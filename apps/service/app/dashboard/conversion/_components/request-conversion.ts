import type { ApiResponse, FileWithUrl } from "@repo/types";

export type ConversionSource =
  { kind: "device"; file: File } | { kind: "vaze"; file: FileWithUrl };

type ReadHeader = (name: string) => string | null;

type Conversion = {
  url: string;
  /** Sent with the files, in the JSON body or as form fields, where lists go as JSON. */
  options?: Record<string, string | number | boolean | object>;
  /** The result's expected size, for responses that stream without a length. */
  expectedSize?: (header: ReadHeader) => number | null;
} & (
  | { source: ConversionSource }
  /** Sent in this order; stored files go by id, among the uploaded ones. */
  | { sources: ConversionSource[] }
);

const formValue = (value: string | number | boolean | object) =>
  typeof value === "object" ? JSON.stringify(value) : String(value);

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
  conversion: Conversion,
  handlers: Handlers,
): () => void {
  const { url, options = {}, expectedSize } = conversion;
  const sources =
    "sources" in conversion ? conversion.sources : [conversion.source];

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

  // a job that runs on afterwards answers 202 with its status
  const succeeded = () => xhr.status >= 200 && xhr.status < 300;

  xhr.onprogress = (event) => {
    if (!succeeded()) return;
    const total = event.lengthComputable ? event.total : expected;
    // an estimate can be off by a few frames, so 100% waits for the end
    handlers.onProgress(
      event.loaded,
      total ? Math.min(event.loaded / total, 0.99) : null,
    );
  };

  xhr.onload = async () => {
    if (succeeded()) handlers.onDone(xhr.response as Blob, header);
    else handlers.onError(await errorMessageOf(xhr));
  };
  xhr.onerror = () => handlers.onError("Network error, check your connection");

  if (sources.some((source) => source.kind === "device")) {
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        handlers.onUploadProgress(event.loaded / event.total);
      }
    };
    const body = new FormData();
    for (const [name, value] of Object.entries(options)) {
      body.append(name, formValue(value));
    }
    for (const source of sources) {
      if (source.kind === "device") body.append("file", source.file);
      else body.append("fileId", source.file.id);
    }
    xhr.send(body);
  } else {
    xhr.setRequestHeader("Content-Type", "application/json");
    // every source is a stored one here
    const ids = sources.flatMap((source) =>
      source.kind === "vaze" ? [source.file.id] : [],
    );
    xhr.send(
      JSON.stringify({
        ...("sources" in conversion ? { fileIds: ids } : { fileId: ids[0] }),
        ...options,
      }),
    );
  }

  return () => xhr.abort();
}
