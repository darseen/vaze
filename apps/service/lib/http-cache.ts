import { NextRequest, NextResponse } from "next/server";
import fs, { type Stats } from "node:fs";
import { Readable } from "node:stream";

export interface Validators {
  etag: string;
  lastModified: string;
}

type Range =
  | { type: "ok"; start: number; end: number }
  | { type: "unsatisfiable" }
  | { type: "ignore" };

/**
 * Strong validators derived from size and mtime, the same shape nginx and
 * Apache use. mtime is floored to seconds so the ETag can never disagree with
 * `Last-Modified`, which has no sub-second precision.
 */
export function fileValidators(stats: Stats): Validators {
  const seconds = Math.floor(stats.mtimeMs / 1000);

  return {
    etag: `"${stats.size.toString(16)}-${seconds.toString(16)}"`,
    lastModified: new Date(seconds * 1000).toUTCString(),
  };
}

// If-None-Match uses weak comparison, so `W/"x"` matches `"x"`.
function etagMatches(header: string, etag: string): boolean {
  if (header.trim() === "*") return true;

  return header
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === etag || candidate === `W/${etag}`);
}

export function isNotModified(
  request: NextRequest,
  { etag, lastModified }: Validators,
): boolean {
  // a present If-None-Match makes If-Modified-Since irrelevant
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) return etagMatches(ifNoneMatch, etag);

  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) return false;

  const since = Date.parse(ifModifiedSince);
  if (Number.isNaN(since)) return false;

  return Date.parse(lastModified) <= since;
}

/**
 * Whether a `Range` should still be honoured. If-Range demands *strong*
 * comparison — a stale validator means the client is holding a different
 * version, so it must get the whole file rather than a splice of two.
 */
function ifRangeSatisfied(
  request: NextRequest,
  { etag, lastModified }: Validators,
): boolean {
  const ifRange = request.headers.get("if-range");
  if (!ifRange) return true;

  const value = ifRange.trim();
  if (value.startsWith('"') || value.startsWith("W/")) return value === etag;

  const since = Date.parse(value);
  return !Number.isNaN(since) && Date.parse(lastModified) === since;
}

export function parseRange(header: string | null, size: number): Range {
  if (!header) return { type: "ignore" };

  const match = /^bytes=(.*)$/i.exec(header.trim());
  if (!match) return { type: "ignore" };

  // multipart/byteranges is rarely worth the complexity, and a server is
  // always free to ignore a Range it does not want to honour
  const specs = match[1].split(",");
  if (specs.length !== 1) return { type: "ignore" };

  const parts = /^(\d*)-(\d*)$/.exec(specs[0].trim());
  if (!parts) return { type: "ignore" };

  const [, rawStart, rawEnd] = parts;
  if (rawStart === "" && rawEnd === "") return { type: "ignore" };

  let start: number;
  let end: number;

  if (rawStart === "") {
    // suffix form: the final N bytes
    const suffix = Number.parseInt(rawEnd, 10);
    if (suffix === 0) return { type: "unsatisfiable" };
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number.parseInt(rawStart, 10);
    end =
      rawEnd === "" ? size - 1 : Math.min(Number.parseInt(rawEnd, 10), size - 1);
  }

  if (start >= size || start > end) return { type: "unsatisfiable" };

  return { type: "ok", start, end };
}

/**
 * Stream a file with conditional-GET and byte-range handling. The caller owns
 * `Content-Type`, `Content-Disposition`, `Cache-Control` and any security
 * headers; this adds `Accept-Ranges`, `Content-Length`, the validators, and
 * picks between `200`, `206`, `304` and `416`.
 *
 * `cacheable` is false for private objects: they are sent `no-store`, so
 * offering them a revalidation path would contradict it. Ranges still work.
 */
export function streamFileResponse({
  request,
  path,
  stats,
  headers,
  cacheable,
}: {
  request: NextRequest;
  path: string;
  stats: Stats;
  headers: Record<string, string>;
  cacheable: boolean;
}): NextResponse {
  const validators = fileValidators(stats);

  const responseHeaders: Record<string, string> = {
    ...headers,
    "Accept-Ranges": "bytes",
  };

  if (cacheable) {
    responseHeaders["ETag"] = validators.etag;
    responseHeaders["Last-Modified"] = validators.lastModified;

    if (isNotModified(request, validators)) {
      return new NextResponse(null, { status: 304, headers: responseHeaders });
    }
  }

  const range = ifRangeSatisfied(request, validators)
    ? parseRange(request.headers.get("range"), stats.size)
    : { type: "ignore" as const };

  if (range.type === "unsatisfiable") {
    return NextResponse.json(
      { data: null, error: { message: "Range not satisfiable" } },
      {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${stats.size}`,
        },
      },
    );
  }

  const partial = range.type === "ok" ? range : null;

  const nodeStream = partial
    ? fs.createReadStream(path, { start: partial.start, end: partial.end })
    : fs.createReadStream(path);

  if (partial) {
    responseHeaders["Content-Range"] =
      `bytes ${partial.start}-${partial.end}/${stats.size}`;
    responseHeaders["Content-Length"] = String(
      partial.end - partial.start + 1,
    );
  } else {
    responseHeaders["Content-Length"] = String(stats.size);
  }

  return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
    status: partial ? 206 : 200,
    headers: responseHeaders,
  });
}
