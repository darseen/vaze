import { eq, sql } from "drizzle-orm";
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
// server actions revalidate paths, which needs a request scope these tests
// never enter
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const session = { user: { id: "test-user" } as { id: string } | null };
vi.mock("@/utils/auth", () => ({ default: async () => session.user }));

const { DELETE, POST } = await import("@/app/api/files/route");
const { DELETE: DELETE_FOLDER, POST: POST_FOLDER } = await import(
  "@/app/api/folders/route"
);
const { toStoragePath } = await import("@/app/api/_utils");
const { db } = await import("@/db");
const {
  activities,
  files: filesTable,
  folders: foldersTable,
  users,
} = await import("@repo/db");
const { clearActivities, deleteActivities } = await import(
  "@/actions/activity/delete-activities"
);

// the auth stub hands out "test-user", and activities are foreign-keyed to a
// real row
db.insert(users)
  .values([
    { id: "test-user", name: "tester", email: "tester@example.com" },
    { id: "other-user", name: "other", email: "other@example.com" },
  ])
  .onConflictDoNothing()
  .run();

async function reset() {
  session.user = { id: "test-user" };
  db.delete(activities).run();
  db.delete(filesTable).run();
  db.run(sql`DELETE FROM folders WHERE key != ''`);
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
}

function history() {
  return db.select().from(activities).all();
}

function seed(userId: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const id = `${userId}-${index}`;
    db.insert(activities)
      .values({ id, userId, type: "upload.succeeded", target: `${index}.txt` })
      .run();
    return id;
  });
}

beforeEach(reset);

describe("upload history", () => {
  it("records a successful upload against the file it stored", async () => {
    await POST(uploadRequest("", [{ name: "photo.png", content: "png" }]));

    const [entry, ...rest] = history();
    expect(rest).toHaveLength(0);
    expect(entry.type).toBe("upload.succeeded");
    expect(entry.target).toBe("photo.png");
    expect(entry.userId).toBe("test-user");
  });

  it("collapses a batch into one entry that still lists the names", async () => {
    await POST(
      uploadRequest("", [
        { name: "a.txt", content: "a" },
        { name: "b.txt", content: "b" },
      ]),
    );

    const [entry] = history();
    expect(entry.type).toBe("upload.succeeded");
    expect(entry.target).toBe("2 files");
    expect(entry.detail).toBe("a.txt, b.txt");
  });

  it("records a failure with the reason the API gave", async () => {
    const upload = () =>
      POST(uploadRequest("", [{ name: "dupe.txt", content: "x" }]));

    await upload();
    await upload();

    const [, failure] = history();
    expect(failure.type).toBe("upload.failed");
    expect(failure.target).toBe("dupe.txt");
    expect(failure.detail).toContain("already exists");
  });

  it("keeps no history for a request that was never authorized", async () => {
    await anonymously(() =>
      POST(uploadRequest("", [{ name: "nope.txt", content: "x" }])),
    );

    expect(history()).toHaveLength(0);
  });
});

describe("delete history", () => {
  async function upload(...names: string[]) {
    const response = await POST(
      uploadRequest(
        "",
        names.map((name) => ({ name, content: "x" })),
      ),
    );
    const { data } = await readJson(response);
    // the upload's own entry is not what these tests are about
    db.delete(activities).run();

    return data.files.map((file: { id: string }) => file.id);
  }

  it("records a single delete by name", async () => {
    const [id] = await upload("gone.txt");

    await DELETE(jsonRequest("/api/files", "DELETE", { id }));

    const [entry, ...rest] = history();
    expect(rest).toHaveLength(0);
    expect(entry.type).toBe("file.deleted");
    expect(entry.target).toBe("gone.txt");
  });

  it("collapses a batch delete into one entry", async () => {
    const ids = await upload("a.txt", "b.txt");

    await DELETE(jsonRequest("/api/files", "DELETE", { ids }));

    const [entry] = history();
    expect(entry.type).toBe("file.deleted");
    expect(entry.target).toBe("2 files");
    // the rows come back in whatever order the id lookup yields
    expect(entry.detail?.split(", ").sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("stays quiet when the ids matched nothing", async () => {
    await DELETE(jsonRequest("/api/files", "DELETE", { ids: ["ghost"] }));

    expect(history()).toHaveLength(0);
  });

  it("records a folder delete with the path it took down", async () => {
    await POST_FOLDER(
      jsonRequest("/api/folders", "POST", { folder: "projects/demo" }),
    );

    const folder = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.key, "projects/demo"))
      .get()!;

    await DELETE_FOLDER(jsonRequest("/api/folders", "DELETE", { id: folder.id }));

    const [entry] = history();
    expect(entry.type).toBe("folder.deleted");
    expect(entry.target).toBe("demo");
    expect(entry.detail).toBe("projects/demo");
  });
});

describe("deleting history", () => {
  it("deletes only the selected entries", async () => {
    const [first, second, third] = seed("test-user", 3);

    const { data } = await deleteActivities([first, third]);

    expect(data?.deleted).toBe(2);
    expect(history().map((entry) => entry.id)).toEqual([second]);
  });

  it("never deletes an entry belonging to someone else", async () => {
    const [theirs] = seed("other-user", 1);
    const [mine] = seed("test-user", 1);

    await deleteActivities([theirs, mine]);

    expect(history().map((entry) => entry.id)).toEqual([theirs]);
  });

  it("clears every entry the caller owns and nobody else's", async () => {
    seed("test-user", 3);
    seed("other-user", 2);

    const { data } = await clearActivities();

    expect(data?.deleted).toBe(3);
    expect(
      db
        .select()
        .from(activities)
        .where(eq(activities.userId, "other-user"))
        .all(),
    ).toHaveLength(2);
  });

  it("refuses to act for a signed-out caller", async () => {
    const [mine] = seed("test-user", 1);
    session.user = null;

    const { error } = await deleteActivities([mine]);

    expect(error?.message).toBe("Unauthorized");
    expect(history()).toHaveLength(1);
  });
});
