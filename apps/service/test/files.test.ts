import { sql } from "drizzle-orm";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorizedStub,
  jsonRequest,
  readJson,
  uploadRequest,
} from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

const { DELETE, POST, PUT } = await import("@/app/api/files/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { BASE_TMP_PATH } = await import("@/constants");
const { db } = await import("@/db");
const { files: filesTable, folders: foldersTable } = await import("@repo/db");

async function reset() {
  db.delete(filesTable).run();
  // keep the root folder; drop everything under it
  db.run(sql`DELETE FROM folders WHERE key != ''`);
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
}

beforeEach(reset);

describe("upload", () => {
  it("stores a file under its real name at the requested key", async () => {
    const response = await POST(
      uploadRequest("projects/demo", [
        { name: "photo.png", content: "pretend-png" },
      ]),
    );

    expect(response.status).toBe(200);

    const { data } = await readJson(response);
    expect(data.files).toHaveLength(1);

    const [file] = data.files;
    // no random suffix — the caller controls the key
    expect(file.name).toBe("photo.png");
    expect(file.key).toBe("projects/demo/photo.png");
    expect(file.url).toBe("api/hosting/projects/demo/photo.png");
    expect(file.mimeType).toBe("image/png");

    await expect(
      fs.readFile(toStoragePath("projects/demo/photo.png"), "utf8"),
    ).resolves.toBe("pretend-png");
  });

  it("never exposes an absolute filesystem path", async () => {
    const response = await POST(
      uploadRequest("", [{ name: "a.txt", content: "x" }]),
    );
    const { data } = await readJson(response);

    expect(data.files[0]).not.toHaveProperty("path");
    expect(JSON.stringify(data)).not.toContain(toStoragePath(""));
  });

  it("accepts the same name in two different folders", async () => {
    const first = await POST(
      uploadRequest("one", [{ name: "logo.png", content: "a" }]),
    );
    const second = await POST(
      uploadRequest("two", [{ name: "logo.png", content: "b" }]),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("rejects the same name twice in one folder", async () => {
    await POST(uploadRequest("one", [{ name: "logo.png", content: "a" }]));
    const conflict = await POST(
      uploadRequest("one", [{ name: "logo.png", content: "b" }]),
    );

    expect(conflict.status).toBe(409);
    // the original is untouched
    await expect(
      fs.readFile(toStoragePath("one/logo.png"), "utf8"),
    ).resolves.toBe("a");
  });

  it("rejects a file larger than MAX_UPLOAD_SIZE and stages nothing", async () => {
    const oversize = "x".repeat(128 * 1024); // setup pins the cap at 64kb

    const response = await POST(
      uploadRequest("big", [{ name: "huge.bin", content: oversize }]),
    );

    expect(response.status).toBe(413);

    // nothing committed, and the staging area is clean
    expect(db.select().from(filesTable).all()).toHaveLength(0);
    await expect(fs.readdir(BASE_TMP_PATH)).resolves.toEqual([]);
  });

  it("rejects a batch containing duplicate names", async () => {
    const response = await POST(
      uploadRequest("dup", [
        { name: "same.txt", content: "a" },
        { name: "same.txt", content: "b" },
      ]),
    );

    expect(response.status).toBe(400);
    expect(db.select().from(filesTable).all()).toHaveLength(0);
  });

  it("creates the nested folder rows for a deep key", async () => {
    await POST(uploadRequest("a/b/c", [{ name: "f.txt", content: "x" }]));

    const keys = db
      .select({ key: foldersTable.key })
      .from(foldersTable)
      .all()
      .map((row) => row.key)
      .sort();

    expect(keys).toEqual(["", "a", "a/b", "a/b/c"]);
  });
});

describe("rename", () => {
  it("scopes the collision check to the folder", async () => {
    await POST(uploadRequest("one", [{ name: "a.txt", content: "1" }]));
    const second = await POST(
      uploadRequest("two", [{ name: "b.txt", content: "2" }]),
    );
    const { data } = await readJson(second);
    const target = data.files[0];

    // "a.txt" exists, but in a different folder — this must succeed
    const response = await PUT(
      jsonRequest("/api/files", "PUT", { id: target.id, name: "a.txt" }),
    );

    expect(response.status).toBe(200);
    await expect(fs.readFile(toStoragePath("two/a.txt"), "utf8")).resolves.toBe(
      "2",
    );
  });

  it("rejects a rename onto a name taken in the same folder", async () => {
    await POST(
      uploadRequest("one", [
        { name: "a.txt", content: "1" },
        { name: "b.txt", content: "2" },
      ]),
    );

    const row = db
      .select()
      .from(filesTable)
      .all()
      .find((file) => file.name === "b.txt")!;

    const response = await PUT(
      jsonRequest("/api/files", "PUT", { id: row.id, name: "a.txt" }),
    );

    expect(response.status).toBe(409);
  });

  it("rejects a name containing a path separator", async () => {
    await POST(uploadRequest("one", [{ name: "a.txt", content: "1" }]));
    const row = db.select().from(filesTable).all()[0]!;

    const response = await PUT(
      jsonRequest("/api/files", "PUT", { id: row.id, name: "../escaped.txt" }),
    );

    expect(response.status).toBe(400);
  });
});

describe("delete", () => {
  it("removes the row even when the file is already gone from disk", async () => {
    await POST(uploadRequest("one", [{ name: "a.txt", content: "1" }]));
    const row = db.select().from(filesTable).all()[0]!;

    await fs.rm(toStoragePath(row.key));

    const response = await DELETE(
      jsonRequest("/api/files", "DELETE", { id: row.id }),
    );

    expect(response.status).toBe(200);
    expect(db.select().from(filesTable).all()).toHaveLength(0);
  });

  it("deletes every id in a batch", async () => {
    await POST(
      uploadRequest("one", [
        { name: "a.txt", content: "1" },
        { name: "b.txt", content: "2" },
        { name: "c.txt", content: "3" },
      ]),
    );

    const rows = db.select().from(filesTable).all();
    const doomed = rows.filter((row) => row.name !== "c.txt");

    const response = await DELETE(
      jsonRequest("/api/files", "DELETE", {
        ids: doomed.map((row) => row.id),
      }),
    );

    expect(response.status).toBe(200);

    const { data } = await readJson(response);
    expect(data.deleted).toHaveLength(2);
    expect(data.failed).toHaveLength(0);

    const remaining = db.select().from(filesTable).all();
    expect(remaining.map((row) => row.name)).toEqual(["c.txt"]);

    for (const row of doomed) {
      await expect(fs.access(toStoragePath(row.key))).rejects.toThrow();
    }
  });

  it("reports unknown ids without failing the rest of the batch", async () => {
    await POST(uploadRequest("one", [{ name: "a.txt", content: "1" }]));
    const row = db.select().from(filesTable).all()[0]!;

    const response = await DELETE(
      jsonRequest("/api/files", "DELETE", { ids: [row.id, "does-not-exist"] }),
    );

    expect(response.status).toBe(200);

    const { data } = await readJson(response);
    expect(data.deleted).toEqual([row.id]);
    expect(data.failed).toEqual([
      { id: "does-not-exist", message: "File not found" },
    ]);
    expect(db.select().from(filesTable).all()).toHaveLength(0);
  });

  it("404s when none of the ids exist", async () => {
    const response = await DELETE(
      jsonRequest("/api/files", "DELETE", { ids: ["nope"] }),
    );

    expect(response.status).toBe(404);
  });

  it("rejects an empty batch", async () => {
    const response = await DELETE(
      jsonRequest("/api/files", "DELETE", { ids: [] }),
    );

    expect(response.status).toBe(400);
  });
});
