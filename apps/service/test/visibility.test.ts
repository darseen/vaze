import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  anonymously,
  authorizedStub,
  jsonRequest,
  readJson,
  uploadRequest,
} from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

const { GET: serveHosted } = await import("@/app/api/hosting/[...key]/route");
const { POST: uploadFiles, PUT: updateFile } = await import(
  "@/app/api/files/route"
);
const { POST: signFile } = await import("@/app/api/files/sign/route");
const { PUT: updateFolder } = await import("@/app/api/folders/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { signKey } = await import("@/lib/presign");
const { db } = await import("@/db");
const { files: filesTable, folders: foldersTable } = await import("@repo/db");
const { eq } = await import("drizzle-orm");

function serve(key: string, query = "") {
  const segments = key.split("/");
  const url = `http://localhost/api/hosting/${segments.join("/")}${query}`;

  return serveHosted(new NextRequest(url), {
    params: Promise.resolve({ key: segments }),
  });
}

async function upload(
  folder: string,
  name: string,
  visibility?: "public" | "private",
) {
  return uploadFiles(
    uploadRequest(folder, [{ name, content: "payload" }], visibility),
  );
}

function rowFor(key: string) {
  return db.select().from(filesTable).where(eq(filesTable.key, key)).get();
}

/** A signature that is valid right now. */
function validQuery(key: string, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `?exp=${exp}&sig=${signKey(key, exp)}`;
}

beforeEach(async () => {
  db.delete(filesTable).run();
  db.delete(foldersTable).run();
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
});

describe("defaults", () => {
  it("uploads public unless told otherwise, and serves anonymously", async () => {
    await upload("", "a.txt");

    expect(rowFor("a.txt")?.visibility).toBe("public");

    const response = await anonymously(() => serve("a.txt"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("payload");
  });

  it("honours a visibility field on the upload", async () => {
    await upload("secrets", "b.txt", "private");

    expect(rowFor("secrets/b.txt")?.visibility).toBe("private");
  });
});

describe("private reads", () => {
  it("is indistinguishable from a missing file when unsigned", async () => {
    await upload("", "hidden.txt", "private");

    const denied = await anonymously(() => serve("hidden.txt"));
    const missing = await anonymously(() => serve("never-existed.txt"));

    expect(denied.status).toBe(404);
    expect(await readJson(denied)).toEqual(await readJson(missing));
  });

  it("serves an authenticated caller without a signature", async () => {
    await upload("", "hidden.txt", "private");

    const response = await serve("hidden.txt");

    expect(response.status).toBe(200);
  });

  it("marks the response uncacheable", async () => {
    await upload("", "hidden.txt", "private");

    const response = await serve("hidden.txt");

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("leaves public responses without a private cache directive", async () => {
    await upload("", "open.txt");

    const response = await serve("open.txt");

    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});

describe("signed urls", () => {
  it("serves a valid signature anonymously", async () => {
    await upload("", "hidden.txt", "private");

    const response = await anonymously(() =>
      serve("hidden.txt", validQuery("hidden.txt")),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("payload");
  });

  it("rejects an expired signature", async () => {
    await upload("", "hidden.txt", "private");

    const exp = Math.floor(Date.now() / 1000) - 1;
    const query = `?exp=${exp}&sig=${signKey("hidden.txt", exp)}`;

    const response = await anonymously(() => serve("hidden.txt", query));

    expect(response.status).toBe(404);
  });

  it("rejects a tampered, truncated or absent signature", async () => {
    await upload("", "hidden.txt", "private");

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const real = signKey("hidden.txt", exp);

    const bad = [
      `?exp=${exp}&sig=${real.slice(0, -1)}x`,
      `?exp=${exp}&sig=${real.slice(0, 10)}`,
      `?exp=${exp}`,
      `?sig=${real}`,
    ];

    for (const query of bad) {
      const response = await anonymously(() => serve("hidden.txt", query));
      expect(response.status, query).toBe(404);
    }
  });

  it("rejects a later expiry pinned to an older signature", async () => {
    await upload("", "hidden.txt", "private");

    const exp = Math.floor(Date.now() / 1000) + 60;
    const query = `?exp=${exp + 86400}&sig=${signKey("hidden.txt", exp)}`;

    const response = await anonymously(() => serve("hidden.txt", query));

    expect(response.status).toBe(404);
  });

  it("does not let a signature for one key unlock another", async () => {
    await upload("", "a.txt", "private");
    await upload("", "b.txt", "private");

    const response = await anonymously(() =>
      serve("b.txt", validQuery("a.txt")),
    );

    expect(response.status).toBe(404);
  });

  it("mints a working link through the sign endpoint", async () => {
    await upload("docs", "report.pdf", "private");

    const signed = await signFile(
      jsonRequest("/api/files/sign", "POST", {
        key: "docs/report.pdf",
        expiresIn: 60,
      }),
    );

    const { data } = await readJson(signed);
    const query = data.url.slice(data.url.indexOf("?"));

    const response = await anonymously(() => serve("docs/report.pdf", query));

    expect(response.status).toBe(200);
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("changing visibility", () => {
  it("flips a single file without touching the bytes on disk", async () => {
    await upload("", "a.txt", "private");

    await updateFile(
      jsonRequest("/api/files", "PUT", {
        id: rowFor("a.txt")!.id,
        visibility: "public",
      }),
    );

    expect(rowFor("a.txt")?.visibility).toBe("public");
    await expect(fs.readFile(toStoragePath("a.txt"), "utf8")).resolves.toBe(
      "payload",
    );
  });

  it("rejects an unknown visibility", async () => {
    await upload("", "a.txt");

    const response = await updateFile(
      jsonRequest("/api/files", "PUT", {
        id: rowFor("a.txt")!.id,
        visibility: "secret",
      }),
    );

    expect(response.status).toBe(400);
    expect(rowFor("a.txt")?.visibility).toBe("public");
  });

  it("rejects an update that changes nothing", async () => {
    await upload("", "a.txt");

    const response = await updateFile(
      jsonRequest("/api/files", "PUT", { id: rowFor("a.txt")!.id }),
    );

    expect(response.status).toBe(400);
  });

  it("keeps a rename private and breaks the old signed link", async () => {
    await upload("", "a.txt", "private");

    const query = validQuery("a.txt");

    await updateFile(
      jsonRequest("/api/files", "PUT", {
        id: rowFor("a.txt")!.id,
        name: "b.txt",
      }),
    );

    expect(rowFor("b.txt")?.visibility).toBe("private");

    // the key moved, so the signature no longer addresses anything
    const response = await anonymously(() => serve("a.txt", query));
    expect(response.status).toBe(404);
  });
});

describe("folder cascade", () => {
  it("covers nested descendants and leaves siblings alone", async () => {
    await upload("project", "top.txt");
    await upload("project/deep/deeper", "bottom.txt");
    await upload("other", "sibling.txt");

    const folder = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.key, "project"))
      .get();

    const response = await updateFolder(
      jsonRequest("/api/folders", "PUT", {
        id: folder!.id,
        visibility: "private",
      }),
    );

    expect(response.status).toBe(200);
    expect(rowFor("project/top.txt")?.visibility).toBe("private");
    expect(rowFor("project/deep/deeper/bottom.txt")?.visibility).toBe(
      "private",
    );
    expect(rowFor("other/sibling.txt")?.visibility).toBe("public");
  });

  it("accepts the root folder as a cascade target", async () => {
    await upload("", "a.txt");
    await upload("nested", "b.txt");

    const root = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.key, ""))
      .get();

    const response = await updateFolder(
      jsonRequest("/api/folders", "PUT", {
        id: root!.id,
        visibility: "private",
      }),
    );

    expect(response.status).toBe(200);
    expect(rowFor("a.txt")?.visibility).toBe("private");
    expect(rowFor("nested/b.txt")?.visibility).toBe("private");
  });

  it("still refuses to rename the root", async () => {
    await upload("", "a.txt");

    const root = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.key, ""))
      .get();

    const response = await updateFolder(
      jsonRequest("/api/folders", "PUT", { id: root!.id, name: "renamed" }),
    );

    expect(response.status).toBe(400);
  });
});

describe("download disposition", () => {
  it("switches to attachment on request", async () => {
    await upload("", "a.txt");

    const inline = await serve("a.txt");
    const attachment = await serve("a.txt", "?download=1");

    expect(inline.headers.get("Content-Disposition")).toContain("inline");
    expect(attachment.headers.get("Content-Disposition")).toContain(
      "attachment",
    );
  });
});
