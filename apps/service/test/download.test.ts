import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import nodeFs from "node:fs";
import fs from "node:fs/promises";
import zlib from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import yauzl from "yauzl";
import {
  anonymously,
  authorizedStub,
  jsonRequest,
  readJson,
  uploadRequest,
} from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

// small enough that the cap is cheap to exceed
process.env.MAX_DOWNLOAD_BATCH = "3";

const { POST: upload, PUT: rename } = await import("@/app/api/files/route");
const { POST: downloadFiles } = await import("@/app/api/files/download/route");
const { GET: downloadFolder } =
  await import("@/app/api/folders/download/route");
const { POST: createFolder } = await import("@/app/api/folders/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { db } = await import("@/db");
const { files: filesTable, folders: foldersTable } = await import("@repo/db");

async function reset() {
  db.delete(filesTable).run();
  db.run(sql`DELETE FROM folders WHERE key != ''`);
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
}

beforeEach(reset);

async function put(folder: string, name: string, content = name) {
  const response = await upload(uploadRequest(folder, [{ name, content }]));
  const { data } = await readJson(response);
  return data.files[0] as { id: string; key: string };
}

function folderId(key: string): string {
  const all = db.select().from(foldersTable).all();
  return all.find((folder) => folder.key === key)!.id;
}

function folderRequest(query = "") {
  return new NextRequest(`http://localhost/api/folders/download${query}`);
}

function formRequest(ids: string[]) {
  const body = new URLSearchParams(ids.map((id) => ["ids", id]));
  return new NextRequest("http://localhost/api/files/download", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

/** Entry names in archive order, mapped to their text (null for directories). */
async function unzip(response: Response) {
  const body = Buffer.from(await response.arrayBuffer());
  expect(response.headers.get("content-length")).toBe(String(body.length));

  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
    yauzl.fromBuffer(body, { lazyEntries: true }, (error, zip) =>
      error ? reject(error) : resolve(zip),
    ),
  );

  const entries: Record<string, string | null> = {};

  await new Promise<void>((resolve, reject) => {
    zip.on("error", reject);
    zip.on("end", resolve);
    zip.on("entry", (entry: yauzl.Entry) => {
      if (entry.fileName.endsWith("/")) {
        entries[entry.fileName] = null;
        return zip.readEntry();
      }

      zip.openReadStream(entry, async (error, stream) => {
        if (error) return reject(error);

        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        const data = Buffer.concat(chunks);

        if (zlib.crc32(data) !== entry.crc32) {
          return reject(new Error(`crc mismatch in ${entry.fileName}`));
        }

        entries[entry.fileName] = data.toString("utf8");
        zip.readEntry();
      });
    });
    zip.readEntry();
  });

  return entries;
}

describe("folder download", () => {
  it("zips a folder recursively under its own name", async () => {
    await put("photos", "b.txt", "bee");
    await put("photos", "a.txt", "ay");
    await put("photos/2026/june", "c.txt", "see");
    await createFolder(
      jsonRequest("/api/folders", "POST", { folder: "photos/empty" }),
    );

    const response = await downloadFolder(
      folderRequest(`?id=${folderId("photos")}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="photos.zip"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");

    const entries = await unzip(response);
    expect(entries).toEqual({
      "photos/": null,
      "photos/a.txt": "ay",
      "photos/b.txt": "bee",
      "photos/2026/": null,
      "photos/2026/june/": null,
      "photos/2026/june/c.txt": "see",
      "photos/empty/": null,
    });
    // directories first, then files, then subfolders
    expect(Object.keys(entries)).toEqual([
      "photos/",
      "photos/a.txt",
      "photos/b.txt",
      "photos/2026/",
      "photos/2026/june/",
      "photos/2026/june/c.txt",
      "photos/empty/",
    ]);
  });

  it("finds a folder by key", async () => {
    await put("docs/specs", "spec.md", "# spec");

    const response = await downloadFolder(folderRequest("?key=docs/specs/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="specs.zip"',
    );
    await expect(unzip(response)).resolves.toEqual({
      "specs/": null,
      "specs/spec.md": "# spec",
    });
  });

  it("zips the whole instance when no folder is named", async () => {
    await put("", "top.txt", "top");
    await put("nested", "deep.txt", "deep");

    const response = await downloadFolder(folderRequest());
    expect(response.headers.get("content-disposition")).toContain(
      'filename="files.zip"',
    );
    await expect(unzip(response)).resolves.toEqual({
      "files/": null,
      "files/top.txt": "top",
      "files/nested/": null,
      "files/nested/deep.txt": "deep",
    });
  });

  it("includes private and empty files", async () => {
    await upload(
      uploadRequest("vault", [{ name: "secret.txt", content: "s" }], "private"),
    );
    await put("vault", "empty.txt", "");

    const response = await downloadFolder(folderRequest("?key=vault"));
    await expect(unzip(response)).resolves.toEqual({
      "vault/": null,
      "vault/empty.txt": "",
      "vault/secret.txt": "s",
    });
  });

  it("keeps non-ASCII names intact", async () => {
    const file = await put("résumés", "plain.txt", "ok");
    // renamed rather than uploaded, as multipart decodes filenames as latin1
    await rename(
      jsonRequest("/api/files", "PUT", { id: file.id, name: "naïve café.txt" }),
    );

    const response = await downloadFolder(folderRequest("?key=résumés"));
    expect(response.headers.get("content-disposition")).toContain(
      `filename*=UTF-8''${encodeURIComponent("résumés.zip")}`,
    );
    await expect(unzip(response)).resolves.toEqual({
      "résumés/": null,
      "résumés/naïve café.txt": "ok",
    });
  });

  it("skips a file whose bytes are gone from disk", async () => {
    await put("mixed", "kept.txt", "kept");
    const lost = await put("mixed", "lost.txt", "lost");
    await fs.rm(toStoragePath(lost.key));

    const response = await downloadFolder(folderRequest("?key=mixed"));
    await expect(unzip(response)).resolves.toEqual({
      "mixed/": null,
      "mixed/kept.txt": "kept",
    });
  });

  it("404s for an unknown folder", async () => {
    expect((await downloadFolder(folderRequest("?id=nope"))).status).toBe(404);
    expect((await downloadFolder(folderRequest("?key=nope"))).status).toBe(404);
  });

  it("requires authorization", async () => {
    const response = await anonymously(() => downloadFolder(folderRequest()));
    expect(response.status).toBe(401);
  });
});

describe("selected files download", () => {
  it("zips files from one folder flat, named after the folder", async () => {
    const a = await put("photos", "a.txt", "ay");
    const b = await put("photos", "b.txt", "bee");
    await put("photos", "unselected.txt");

    const response = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [b.id, a.id] }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="photos.zip"',
    );
    await expect(unzip(response)).resolves.toEqual({
      "a.txt": "ay",
      "b.txt": "bee",
    });
  });

  it("keeps the paths below the deepest common folder", async () => {
    const one = await put("projects/web/src", "index.ts", "one");
    const two = await put("projects/api", "index.ts", "two");

    const response = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [one.id, two.id] }),
    );

    expect(response.headers.get("content-disposition")).toContain(
      'filename="projects.zip"',
    );
    await expect(unzip(response)).resolves.toEqual({
      "api/index.ts": "two",
      "web/src/index.ts": "one",
    });
  });

  it("names a selection spanning the root files.zip", async () => {
    const top = await put("", "top.txt", "top");
    const deep = await put("nested", "deep.txt", "deep");

    const response = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [top.id, deep.id] }),
    );

    expect(response.headers.get("content-disposition")).toContain(
      'filename="files.zip"',
    );
    await expect(unzip(response)).resolves.toEqual({
      "nested/deep.txt": "deep",
      "top.txt": "top",
    });
  });

  it("accepts the ids as form fields", async () => {
    const a = await put("form", "a.txt", "ay");
    const b = await put("form", "b.txt", "bee");

    const response = await downloadFiles(formRequest([a.id, b.id]));
    expect(response.status).toBe(200);
    await expect(unzip(response)).resolves.toEqual({
      "a.txt": "ay",
      "b.txt": "bee",
    });
  });

  it("collapses duplicate ids", async () => {
    const a = await put("dup", "a.txt", "ay");

    const response = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [a.id, a.id] }),
    );
    await expect(unzip(response)).resolves.toEqual({ "a.txt": "ay" });
  });

  it("rejects a missing, empty, or malformed id list", async () => {
    for (const body of [{}, { ids: [] }, { ids: "abc" }, { ids: [1, ""] }]) {
      const response = await downloadFiles(
        jsonRequest("/api/files/download", "POST", body),
      );
      expect(response.status).toBe(400);
    }

    const malformed = new NextRequest("http://localhost/api/files/download", {
      method: "POST",
      body: "{not json",
      headers: { "Content-Type": "application/json" },
    });
    expect((await downloadFiles(malformed)).status).toBe(400);
  });

  it("rejects more than MAX_DOWNLOAD_BATCH ids", async () => {
    const response = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: ["1", "2", "3", "4"] }),
    );

    expect(response.status).toBe(400);
    const { error } = await readJson(response);
    expect(error.message).toBe("Cannot download more than 3 files at once");
  });

  it("404s when any requested file is unknown or gone from disk", async () => {
    const kept = await put("strict", "kept.txt");
    const lost = await put("strict", "lost.txt");

    const unknown = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [kept.id, "nope"] }),
    );
    expect(unknown.status).toBe(404);

    await fs.rm(toStoragePath(lost.key));
    const missing = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [kept.id, lost.id] }),
    );
    expect(missing.status).toBe(404);
  });

  it("requires authorization", async () => {
    const response = await anonymously(() =>
      downloadFiles(jsonRequest("/api/files/download", "POST", { ids: ["x"] })),
    );
    expect(response.status).toBe(401);
  });
});

describe("zip streaming", () => {
  // larger than every buffer between the file and the response
  const LARGE = 8 * 1024 * 1024;

  it("closes the open file when the client goes away", async () => {
    const big = await put("stream", "big.bin");
    await fs.writeFile(toStoragePath(big.key), Buffer.alloc(LARGE));

    const opened: nodeFs.ReadStream[] = [];
    const spy = vi.spyOn(nodeFs, "createReadStream").mockImplementation(((
      ...args: Parameters<typeof nodeFs.createReadStream>
    ) => {
      spy.mockRestore();
      const stream = nodeFs.createReadStream(...args);
      opened.push(stream);
      return stream;
    }) as typeof nodeFs.createReadStream);

    const response = await downloadFolder(folderRequest("?key=stream"));
    const reader = response.body!.getReader();
    await reader.read();

    expect(opened).toHaveLength(1);
    expect(opened[0].destroyed).toBe(false);

    await reader.cancel();
    await new Promise((resolve) => setImmediate(resolve));

    expect(opened[0].destroyed).toBe(true);
  });

  it("fails the response instead of sending a corrupt archive", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const big = await put("shrink", "a.bin");
    const shrunk = await put("shrink", "b.bin", "0123456789");
    await fs.writeFile(toStoragePath(big.key), Buffer.alloc(LARGE));

    const response = await downloadFiles(
      jsonRequest("/api/files/download", "POST", { ids: [big.id, shrunk.id] }),
    );
    expect(response.status).toBe(200);

    // b.bin is not opened until a.bin has been read, so this lands mid-stream
    nodeFs.truncateSync(toStoragePath(shrunk.key), 4);

    await expect(response.arrayBuffer()).rejects.toThrow();
  });

  it("fails the response when a file disappears mid-stream", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const big = await put("vanish", "a.bin");
    const gone = await put("vanish", "b.bin", "0123456789");
    await fs.writeFile(toStoragePath(big.key), Buffer.alloc(LARGE));

    const response = await downloadFolder(folderRequest("?key=vanish"));
    expect(response.status).toBe(200);

    nodeFs.rmSync(toStoragePath(gone.key));

    await expect(response.arrayBuffer()).rejects.toThrow();
  });
});
