import { sql } from "drizzle-orm";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedStub, jsonRequest, readJson } from "./helpers";

vi.mock("@/app/api/_utils/authorize-request", () => authorizedStub);

const { DELETE, POST, PUT } = await import("@/app/api/folders/route");
const { POST: uploadFiles } = await import("@/app/api/files/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { db } = await import("@/db");
const { files: filesTable, folders: foldersTable } = await import("@repo/db");
const { uploadRequest } = await import("./helpers");

async function reset() {
  db.delete(filesTable).run();
  db.run(sql`DELETE FROM folders WHERE key != ''`);
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
}

function rootFolder() {
  return db.select().from(foldersTable).all().find((f) => f.key === "")!;
}

beforeEach(reset);

describe("the root folder is protected", () => {
  it("refuses to delete it and leaves the tree intact", async () => {
    await uploadFiles(uploadRequest("keep", [{ name: "a.txt", content: "1" }]));

    const response = await DELETE(
      jsonRequest("/api/folders", "DELETE", { id: rootFolder().id }),
    );

    expect(response.status).toBe(400);

    const { error } = await readJson(response);
    expect(error.message).toMatch(/root folder cannot be deleted/i);

    // the uploads directory and everything under it survived
    await expect(
      fs.readFile(toStoragePath("keep/a.txt"), "utf8"),
    ).resolves.toBe("1");
    expect(db.select().from(filesTable).all()).toHaveLength(1);
  });

  it("refuses to rename it", async () => {
    const response = await PUT(
      jsonRequest("/api/folders", "PUT", {
        id: rootFolder().id,
        name: "renamed",
      }),
    );

    expect(response.status).toBe(400);
    // the uploads directory is still where the instance expects it
    await expect(fs.stat(toStoragePath(""))).resolves.toBeTruthy();
  });
});

describe("create", () => {
  it("creates a nested folder and its rows", async () => {
    const response = await POST(
      jsonRequest("/api/folders", "POST", { folder: "a/b/c" }),
    );

    expect(response.status).toBe(200);

    const keys = db
      .select({ key: foldersTable.key })
      .from(foldersTable)
      .all()
      .map((row) => row.key)
      .sort();

    expect(keys).toEqual(["", "a", "a/b", "a/b/c"]);
    await expect(fs.stat(toStoragePath("a/b/c"))).resolves.toBeTruthy();
  });

  it("allows dots in folder names but rejects traversal", async () => {
    const dotted = await POST(
      jsonRequest("/api/folders", "POST", { folder: "release/v1.0" }),
    );
    expect(dotted.status).toBe(200);

    for (const folder of ["../escape", "a/../../escape", ".."]) {
      const response = await POST(
        jsonRequest("/api/folders", "POST", { folder }),
      );
      expect(response.status, folder).toBe(400);
    }
  });

  it("rejects a duplicate folder", async () => {
    await POST(jsonRequest("/api/folders", "POST", { folder: "dup" }));
    const again = await POST(
      jsonRequest("/api/folders", "POST", { folder: "dup" }),
    );

    expect(again.status).toBe(409);
  });
});

describe("rename", () => {
  it("rewrites the keys of every descendant", async () => {
    await uploadFiles(
      uploadRequest("old/inner", [{ name: "deep.txt", content: "d" }]),
    );
    await uploadFiles(uploadRequest("old", [{ name: "top.txt", content: "t" }]));

    const old = db
      .select()
      .from(foldersTable)
      .all()
      .find((folder) => folder.key === "old")!;

    const response = await PUT(
      jsonRequest("/api/folders", "PUT", { id: old.id, name: "new" }),
    );

    expect(response.status).toBe(200);

    const fileKeys = db
      .select({ key: filesTable.key })
      .from(filesTable)
      .all()
      .map((row) => row.key)
      .sort();

    expect(fileKeys).toEqual(["new/inner/deep.txt", "new/top.txt"]);

    const folderKeys = db
      .select({ key: foldersTable.key })
      .from(foldersTable)
      .all()
      .map((row) => row.key)
      .sort();

    expect(folderKeys).toEqual(["", "new", "new/inner"]);

    // and the DB still matches what is on disk
    await expect(
      fs.readFile(toStoragePath("new/inner/deep.txt"), "utf8"),
    ).resolves.toBe("d");
  });

  it("rejects a name that would escape the parent", async () => {
    await POST(jsonRequest("/api/folders", "POST", { folder: "here" }));
    const folder = db
      .select()
      .from(foldersTable)
      .all()
      .find((row) => row.key === "here")!;

    for (const name of ["../gone", "a/b", ".."]) {
      const response = await PUT(
        jsonRequest("/api/folders", "PUT", { id: folder.id, name }),
      );
      expect(response.status, name).toBe(400);
    }
  });
});

describe("delete", () => {
  it("removes a subfolder and cascades its files", async () => {
    await uploadFiles(uploadRequest("gone", [{ name: "a.txt", content: "1" }]));

    const folder = db
      .select()
      .from(foldersTable)
      .all()
      .find((row) => row.key === "gone")!;

    const response = await DELETE(
      jsonRequest("/api/folders", "DELETE", { id: folder.id }),
    );

    expect(response.status).toBe(200);
    expect(db.select().from(filesTable).all()).toHaveLength(0);
    await expect(fs.stat(toStoragePath("gone"))).rejects.toThrow();
  });
});
