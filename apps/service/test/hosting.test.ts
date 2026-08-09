import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedStub, uploadRequest } from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

const { GET } = await import("@/app/api/hosting/[...key]/route");
const { POST: uploadFiles } = await import("@/app/api/files/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { db } = await import("@/db");
const { files: filesTable } = await import("@repo/db");

function hostingRequest(segments: string[]) {
  const url = `http://localhost/api/hosting/${segments.join("/")}`;
  return {
    request: new NextRequest(url),
    context: { params: Promise.resolve({ key: segments }) },
  };
}

async function serve(segments: string[]) {
  const { request, context } = hostingRequest(segments);
  return GET(request, context);
}

beforeEach(async () => {
  db.delete(filesTable).run();
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
});

describe("security headers", () => {
  it("serves untrusted content sandboxed and with nosniff", async () => {
    await uploadFiles(
      uploadRequest("site", [
        { name: "evil.html", content: "<script>fetch('/api/files')</script>" },
      ]),
    );

    const response = await serve(["site", "evil.html"]);

    expect(response.status).toBe(200);
    // the XSS fix: an opaque origin with scripts disabled
    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // still embeddable from other sites
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "cross-origin",
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("applies the same headers to an SVG, which is scriptable too", async () => {
    await uploadFiles(
      uploadRequest("", [{ name: "icon.svg", content: "<svg/>" }]),
    );

    const response = await serve(["icon.svg"]);

    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
  });
});

describe("content length", () => {
  it("reports the size on disk, not the recorded size", async () => {
    await uploadFiles(
      uploadRequest("", [{ name: "a.txt", content: "0123456789" }]),
    );

    // drift the stored size the way an out-of-band write would
    db.update(filesTable).set({ size: 99999 }).run();

    const response = await serve(["a.txt"]);

    expect(response.headers.get("Content-Length")).toBe("10");
    await expect(response.text()).resolves.toBe("0123456789");
  });
});

describe("key handling", () => {
  it("serves a nested key", async () => {
    await uploadFiles(
      uploadRequest("a/b", [{ name: "deep.txt", content: "found" }]),
    );

    const response = await serve(["a", "b", "deep.txt"]);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("found");
  });

  it("decodes percent-encoded segments", async () => {
    await uploadFiles(
      uploadRequest("my folder", [{ name: "a b.txt", content: "spaced" }]),
    );

    const response = await serve(["my%20folder", "a%20b.txt"]);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("spaced");
  });

  it("404s on traversal instead of reading outside the uploads root", async () => {
    for (const segments of [["..", "secrets"], ["a", "..", "..", "etc"]]) {
      const response = await serve(segments);
      expect(response.status, segments.join("/")).toBe(404);
    }
  });

  it("404s on a malformed percent-encoding instead of erroring", async () => {
    const response = await serve(["%E0%A4%A"]);

    expect(response.status).toBe(404);
  });

  it("404s when the row exists but the file is gone", async () => {
    await uploadFiles(uploadRequest("", [{ name: "a.txt", content: "1" }]));
    await fs.rm(toStoragePath("a.txt"));

    const response = await serve(["a.txt"]);

    expect(response.status).toBe(404);
  });
});
