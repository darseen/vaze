import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  anonymously,
  authorizedStub,
  jsonRequest,
  readJson,
  uploadRequest,
} from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

const { GET } = await import("@/app/api/files/thumbnail/[id]/route");
const { POST: upload, DELETE: deleteFiles } =
  await import("@/app/api/files/route");
const { DELETE: deleteFolder } = await import("@/app/api/folders/route");
const { thumbnailPath } = await import("@/lib/thumbnails");
const { toStoragePath } = await import("@/app/api/_utils");
const { db } = await import("@/db");
const { files: filesTable, folders: foldersTable } = await import("@repo/db");

beforeEach(async () => {
  db.delete(filesTable).run();
  db.run(sql`DELETE FROM folders WHERE key != ''`);
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
});

function png(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: "#3b82f6" },
  })
    .png()
    .toBuffer();
}

async function put(folder: string, name: string, content: string | Uint8Array) {
  const response = await upload(uploadRequest(folder, [{ name, content }]));
  const { data } = await readJson(response);
  return data.files[0] as { id: string; key: string };
}

function thumbnail(id: string, headers?: HeadersInit) {
  return GET(
    new NextRequest(`http://localhost/api/files/thumbnail/${id}`, { headers }),
    { params: Promise.resolve({ id }) },
  );
}

describe("GET /api/files/thumbnail/[id]", () => {
  it("serves a small webp instead of the original", async () => {
    const file = await put("", "photo.png", await png(1600, 1200));

    const response = await thumbnail(file.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toContain("immutable");

    const body = Buffer.from(await response.arrayBuffer());
    const { format, width, height } = await sharp(body).metadata();
    expect(format).toBe("webp");
    expect(width).toBe(640);
    expect(height).toBe(320);
  });

  it("never enlarges an image smaller than the thumbnail", async () => {
    const file = await put("", "tiny.png", await png(100, 50));

    const response = await thumbnail(file.id);
    const body = Buffer.from(await response.arrayBuffer());

    const { width, height } = await sharp(body).metadata();
    expect([width, height]).toEqual([100, 50]);
  });

  it("renders once and serves later requests from the cache", async () => {
    const file = await put("", "photo.png", await png(1200, 800));

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => thumbnail(file.id)),
    );
    expect(responses.map((response) => response.status)).toEqual(
      Array(5).fill(200),
    );

    // the original is no longer needed once the thumbnail exists
    await fs.rm(toStoragePath(file.key));
    const cached = await thumbnail(file.id);
    expect(cached.status).toBe(200);

    const revalidated = await thumbnail(file.id, {
      "If-None-Match": cached.headers.get("ETag")!,
    });
    expect(revalidated.status).toBe(304);
  });

  it("has no thumbnail for files that aren't images", async () => {
    const file = await put("", "notes.txt", "hello");

    const response = await thumbnail(file.id);

    expect(response.status).toBe(404);
  });

  it("has no thumbnail for an image sharp can't read", async () => {
    const file = await put("", "broken.png", "not really a png");

    const response = await thumbnail(file.id);

    expect(response.status).toBe(404);
    await expect(fs.access(thumbnailPath(file.id))).rejects.toThrow();
  });

  it("404s for an unknown id", async () => {
    const response = await thumbnail("missing");

    expect(response.status).toBe(404);
  });

  it("requires auth", async () => {
    const file = await put("", "photo.png", await png(200, 200));

    const response = await anonymously(() => thumbnail(file.id));

    expect(response.status).toBe(401);
  });
});

describe("thumbnail cleanup", () => {
  it("removes the thumbnail when its file is deleted", async () => {
    const file = await put("", "photo.png", await png(200, 200));
    await thumbnail(file.id);
    await expect(fs.access(thumbnailPath(file.id))).resolves.toBeUndefined();

    await deleteFiles(jsonRequest("/api/files", "DELETE", { id: file.id }));

    await expect(fs.access(thumbnailPath(file.id))).rejects.toThrow();
  });

  it("removes thumbnails of everything under a deleted folder", async () => {
    const nested = await put("trip/day 1", "a.png", await png(200, 200));
    const direct = await put("trip", "b.png", await png(200, 200));
    // a sibling whose key shares the prefix without the slash
    const sibling = await put("trip2", "c.png", await png(200, 200));
    for (const file of [nested, direct, sibling]) await thumbnail(file.id);

    const folder = db
      .select()
      .from(foldersTable)
      .all()
      .find((row) => row.key === "trip")!;
    await deleteFolder(
      jsonRequest("/api/folders", "DELETE", { id: folder.id }),
    );

    await expect(fs.access(thumbnailPath(nested.id))).rejects.toThrow();
    await expect(fs.access(thumbnailPath(direct.id))).rejects.toThrow();
    await expect(fs.access(thumbnailPath(sibling.id))).resolves.toBeUndefined();
  });
});
