import { contentDisposition } from "@/app/api/_utils";
import { NextResponse } from "next/server";
import fs from "node:fs";
import { PassThrough, Readable } from "node:stream";
import { ZipFile } from "yazl";

export type ZipEntry =
  | { type: "directory"; name: string; mtime: Date }
  | { type: "file"; name: string; path: string; size: number; mtime: Date };

/** Name for an archive of a folder key; the root has no name of its own. */
export function archiveName(folderKey: string): string {
  return folderKey ? folderKey.slice(folderKey.lastIndexOf("/") + 1) : "files";
}

/** Stream entries as an uncompressed zip, so its exact size is known up front. */
export function streamZipResponse(
  entries: ZipEntry[],
  filename: string,
): NextResponse {
  const zip = new ZipFile();
  const output = zip.outputStream as PassThrough;
  // the file currently being read, closed if the response ends early
  let current: fs.ReadStream | null = null;

  zip.on("error", (error) => {
    console.error("error streaming zip:", error);
    current?.destroy();
    output.destroy(error);
  });

  // on a client disconnect yazl stalls with the current file still open
  output.on("close", () => current?.destroy());

  for (const entry of entries) {
    if (entry.type === "directory") {
      zip.addEmptyDirectory(entry.name, { mtime: entry.mtime });
      continue;
    }

    const options = { mtime: entry.mtime, compress: false };

    // a read stream cannot be bounded to zero bytes
    if (entry.size === 0) {
      zip.addBuffer(Buffer.alloc(0), entry.name, options);
      continue;
    }

    zip.addReadStreamLazy(
      entry.name,
      { ...options, size: entry.size },
      (callback) => {
        if (output.destroyed) return;

        // bounded so a file growing mid-read cannot overrun Content-Length
        current = fs.createReadStream(entry.path, {
          start: 0,
          end: entry.size - 1,
        });
        current.on("error", (error) => zip.emit("error", error));
        callback(null, current);
      },
    );
  }

  let totalSize = -1;
  // @types/yazl omits the callback's argument
  zip.end(undefined, ((size: number) => {
    totalSize = size;
  }) as () => void);

  const headers: Record<string, string> = {
    "Content-Type": "application/zip",
    "Content-Disposition": contentDisposition("attachment", `${filename}.zip`),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (totalSize >= 0) headers["Content-Length"] = String(totalSize);

  return new NextResponse(Readable.toWeb(output) as ReadableStream, {
    status: 200,
    headers,
  });
}
