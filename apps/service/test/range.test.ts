import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedStub, uploadRequest } from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

const { GET: serveHosted } = await import("@/app/api/hosting/[...key]/route");
const { GET: downloadFile } = await import(
  "@/app/api/files/download/[id]/route"
);
const { POST: uploadFiles } = await import("@/app/api/files/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { db } = await import("@/db");
const { files: filesTable } = await import("@repo/db");
const { eq } = await import("drizzle-orm");

const BODY = "0123456789";

function serve(key: string, headers: Record<string, string> = {}) {
  const segments = key.split("/");

  return serveHosted(
    new NextRequest(`http://localhost/api/hosting/${segments.join("/")}`, {
      headers,
    }),
    { params: Promise.resolve({ key: segments }) },
  );
}

function download(id: string, headers: Record<string, string> = {}) {
  return downloadFile(
    new NextRequest(`http://localhost/api/files/download/${id}`, { headers }),
    { params: Promise.resolve({ id }) },
  );
}

async function upload(name: string, content = BODY, visibility?: "private") {
  await uploadFiles(uploadRequest("", [{ name, content }], visibility));
  return db.select().from(filesTable).where(eq(filesTable.name, name)).get()!;
}

beforeEach(async () => {
  db.delete(filesTable).run();
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
});

describe("range requests", () => {
  it("advertises range support", async () => {
    await upload("a.txt");

    const response = await serve("a.txt");

    expect(response.status).toBe(200);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("serves a closed range as 206", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=2-5" });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(response.headers.get("Content-Length")).toBe("4");
    await expect(response.text()).resolves.toBe("2345");
  });

  it("serves an open-ended range to the last byte", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=7-" });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 7-9/10");
    await expect(response.text()).resolves.toBe("789");
  });

  it("serves a suffix range", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=-3" });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 7-9/10");
    await expect(response.text()).resolves.toBe("789");
  });

  it("clamps an end past the last byte", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=8-999" });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 8-9/10");
    await expect(response.text()).resolves.toBe("89");
  });

  it("clamps a suffix larger than the file", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=-999" });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-9/10");
    await expect(response.text()).resolves.toBe(BODY);
  });

  it("416s a start past the end of the file", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=10-" });

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */10");
  });

  it("416s a zero-length suffix", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { range: "bytes=-0" });

    expect(response.status).toBe(416);
  });

  it("falls back to the whole file for ranges it will not honour", async () => {
    await upload("a.txt");

    // an unparseable unit, a malformed spec, and a multi-range request
    for (const range of ["items=0-5", "bytes=abc", "bytes=0-1,4-5", "bytes=-"]) {
      const response = await serve("a.txt", { range });

      expect(response.status, range).toBe(200);
      await expect(response.text(), range).resolves.toBe(BODY);
    }
  });

  it("supports ranges on a private file reached with a valid session", async () => {
    await upload("secret.txt", BODY, "private");

    const response = await serve("secret.txt", { range: "bytes=0-3" });

    expect(response.status).toBe(206);
    await expect(response.text()).resolves.toBe("0123");
  });
});

describe("conditional GET", () => {
  it("sends validators and a revalidating cache directive", async () => {
    await upload("a.txt");

    const response = await serve("a.txt");

    expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
    expect(response.headers.get("Last-Modified")).toBeTruthy();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
  });

  it("returns a bodiless 304 for a matching ETag", async () => {
    await upload("a.txt");

    const etag = (await serve("a.txt")).headers.get("ETag")!;
    const response = await serve("a.txt", { "if-none-match": etag });

    expect(response.status).toBe(304);
    expect(response.headers.get("ETag")).toBe(etag);
    await expect(response.text()).resolves.toBe("");
  });

  it("matches a weak form of the same ETag", async () => {
    await upload("a.txt");

    const etag = (await serve("a.txt")).headers.get("ETag")!;
    const response = await serve("a.txt", { "if-none-match": `W/${etag}` });

    expect(response.status).toBe(304);
  });

  it("matches a wildcard and a list containing the ETag", async () => {
    await upload("a.txt");

    const etag = (await serve("a.txt")).headers.get("ETag")!;

    for (const header of ["*", `"nope", ${etag}`]) {
      const response = await serve("a.txt", { "if-none-match": header });
      expect(response.status, header).toBe(304);
    }
  });

  it("serves the body when the ETag does not match", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", { "if-none-match": '"stale"' });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(BODY);
  });

  it("honours If-Modified-Since", async () => {
    await upload("a.txt");

    const lastModified = (await serve("a.txt")).headers.get("Last-Modified")!;

    const fresh = await serve("a.txt", { "if-modified-since": lastModified });
    expect(fresh.status).toBe(304);

    const stale = await serve("a.txt", {
      "if-modified-since": new Date(0).toUTCString(),
    });
    expect(stale.status).toBe(200);
  });

  it("ignores If-Modified-Since when If-None-Match is present", async () => {
    await upload("a.txt");

    const lastModified = (await serve("a.txt")).headers.get("Last-Modified")!;

    const response = await serve("a.txt", {
      "if-none-match": '"stale"',
      "if-modified-since": lastModified,
    });

    expect(response.status).toBe(200);
  });

  it("offers no revalidation path for a private file", async () => {
    await upload("secret.txt", BODY, "private");

    const response = await serve("secret.txt");

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("ETag")).toBeNull();
    expect(response.headers.get("Last-Modified")).toBeNull();
  });
});

describe("if-range", () => {
  it("honours the range when the validator still matches", async () => {
    await upload("a.txt");

    const etag = (await serve("a.txt")).headers.get("ETag")!;
    const response = await serve("a.txt", {
      range: "bytes=0-3",
      "if-range": etag,
    });

    expect(response.status).toBe(206);
    await expect(response.text()).resolves.toBe("0123");
  });

  it("sends the whole file when the validator is stale", async () => {
    await upload("a.txt");

    const response = await serve("a.txt", {
      range: "bytes=0-3",
      "if-range": '"stale"',
    });

    // splicing a fresh range into a stale cached copy would corrupt it
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(BODY);
  });

  it("accepts a matching date and rejects a stale one", async () => {
    await upload("a.txt");

    const lastModified = (await serve("a.txt")).headers.get("Last-Modified")!;

    const fresh = await serve("a.txt", {
      range: "bytes=0-3",
      "if-range": lastModified,
    });
    expect(fresh.status).toBe(206);

    const stale = await serve("a.txt", {
      range: "bytes=0-3",
      "if-range": new Date(0).toUTCString(),
    });
    expect(stale.status).toBe(200);
  });
});

describe("downloads", () => {
  it("supports resuming a partial download", async () => {
    const file = await upload("a.txt");

    const response = await download(file.id, { range: "bytes=4-" });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 4-9/10");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    await expect(response.text()).resolves.toBe("456789");
  });

  it("revalidates without resending the body", async () => {
    const file = await upload("a.txt");

    const etag = (await download(file.id)).headers.get("ETag")!;
    const response = await download(file.id, { "if-none-match": etag });

    expect(response.status).toBe(304);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=0, must-revalidate",
    );
  });
});

describe("empty files", () => {
  it("serves a zero-byte file and 416s any range against it", async () => {
    await upload("empty.txt", "");

    const whole = await serve("empty.txt");
    expect(whole.status).toBe(200);
    expect(whole.headers.get("Content-Length")).toBe("0");

    const ranged = await serve("empty.txt", { range: "bytes=0-" });
    expect(ranged.status).toBe(416);
    expect(ranged.headers.get("Content-Range")).toBe("bytes */0");
  });
});
