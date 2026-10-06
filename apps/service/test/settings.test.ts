import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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

const { POST: uploadFiles } = await import("@/app/api/files/route");
const { POST: signFile } = await import("@/app/api/files/sign/route");
const { GET: serveHosted } = await import("@/app/api/hosting/[...key]/route");
const { toStoragePath } = await import("@/app/api/_utils");
const { db, SETTINGS_ID } = await import("@/db");
const { getLimits, setLimits } = await import("@/lib/settings");
const { describeUserAgent } = await import("@/utils/user-agent");
const { formatIpAddress } = await import("@/utils");
const {
  activities,
  files: filesTable,
  settings,
  users,
} = await import("@repo/db");
const { default: updateLimits } =
  await import("@/actions/settings/update-limits");
const { default: applyDefaultVisibility } =
  await import("@/actions/settings/apply-default-visibility");

// whatever setup.ts and the defaults seeded on boot
const seededLimits = getLimits();

// activities are foreign-keyed to a real user row
db.insert(users)
  .values({ id: "test-user", name: "tester", email: "tester@example.com" })
  .onConflictDoNothing()
  .run();

function serve(key: string) {
  return serveHosted(new NextRequest(`http://localhost/api/hosting/${key}`), {
    params: Promise.resolve({ key: key.split("/") }),
  });
}

async function upload(
  name: string,
  content = "payload",
  visibility?: "public" | "private",
) {
  return uploadFiles(uploadRequest("", [{ name, content }], visibility));
}

function visibilityOf(key: string) {
  return db.select().from(filesTable).where(eq(filesTable.key, key)).get()
    ?.visibility;
}

beforeEach(async () => {
  session.user = { id: "test-user" };
  setLimits(seededLimits);
  db.delete(activities).run();
  db.delete(filesTable).run();
  db.run(sql`DELETE FROM folders WHERE key != ''`);
  await fs.rm(toStoragePath(""), { recursive: true, force: true });
  await fs.mkdir(toStoragePath(""), { recursive: true });
});

describe("seeding", () => {
  it("seeds limits from the environment", () => {
    // setup.ts pins MAX_UPLOAD_SIZE; the rest are the built-in defaults
    expect(seededLimits).toEqual({
      maxUploadSize: 64 * 1024,
      defaultPresignTtl: 3600,
      maxPresignTtl: 7 * 24 * 60 * 60,
      hostingCacheMaxAge: 0,
      activityRetentionDays: 90,
      apiRequestRetentionDays: 90,
    });
  });

  it("fills limits a row from an older version is missing, keeping the rest", async () => {
    db.update(settings)
      .set({ maxUploadSize: null, hostingCacheMaxAge: 120 })
      .where(eq(settings.id, SETTINGS_ID))
      .run();

    // a fresh import of the db module is what a restart does
    vi.resetModules();
    await import("@/db");

    // read the row itself: getLimits would fall back to the env value anyway
    const row = db
      .select()
      .from(settings)
      .where(eq(settings.id, SETTINGS_ID))
      .get();

    expect(row?.maxUploadSize).toBe(64 * 1024);
    expect(row?.hostingCacheMaxAge).toBe(120);
  });
});

describe("limits at runtime", () => {
  it("enforces the maximum upload size from settings", async () => {
    setLimits({ ...seededLimits, maxUploadSize: 1024 });

    const tooBig = await upload("big.bin", "x".repeat(2048));
    expect(tooBig.status).toBe(413);

    const fits = await upload("small.bin", "x".repeat(512));
    expect(fits.status).toBe(200);
  });

  it("signs with the default lifetime and clamps to the maximum", async () => {
    setLimits({ ...seededLimits, defaultPresignTtl: 120, maxPresignTtl: 600 });
    await upload("a.txt");

    const lifetimeOf = async (body: Record<string, unknown>) => {
      const now = Date.now();
      const response = await signFile(
        jsonRequest("/api/files/sign", "POST", { key: "a.txt", ...body }),
      );
      const { data } = await readJson(response);
      return Math.round((Date.parse(data.expiresAt) - now) / 1000);
    };

    expect(await lifetimeOf({})).toBeCloseTo(120, -1);
    expect(await lifetimeOf({ expiresIn: 60 * 60 })).toBeCloseTo(600, -1);
  });

  it("sends the public cache lifetime from settings", async () => {
    setLimits({ ...seededLimits, hostingCacheMaxAge: 300 });
    await upload("a.txt");

    const response = await serve("a.txt");

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, must-revalidate",
    );
  });
});

describe("updateLimits", () => {
  it("saves valid limits and prunes history right away", async () => {
    db.insert(activities)
      .values({
        id: "old",
        userId: "test-user",
        type: "upload.succeeded",
        createdAt: sql`datetime('now', '-10 days')`,
      })
      .run();

    const { error } = await updateLimits({
      ...seededLimits,
      activityRetentionDays: 5,
    });

    expect(error).toBeNull();
    expect(getLimits().activityRetentionDays).toBe(5);
    expect(db.select().from(activities).all()).toHaveLength(0);
  });

  it("rejects a default signed link lifetime above the maximum", async () => {
    const { error } = await updateLimits({
      ...seededLimits,
      defaultPresignTtl: 700,
      maxPresignTtl: 600,
    });

    expect(error?.message).toMatch(/can't be longer than the maximum/);
    expect(getLimits()).toEqual(seededLimits);
  });

  it("rejects fractional, too small and missing values", async () => {
    for (const input of [
      { ...seededLimits, maxUploadSize: 1.5 },
      { ...seededLimits, maxUploadSize: 0 },
      { ...seededLimits, hostingCacheMaxAge: -1 },
      { ...seededLimits, activityRetentionDays: undefined },
    ]) {
      const { error } = await updateLimits(input as typeof seededLimits);
      expect(error, JSON.stringify(input)).not.toBeNull();
    }

    expect(getLimits()).toEqual(seededLimits);
  });

  it("accepts a cache lifetime of zero", async () => {
    setLimits({ ...seededLimits, hostingCacheMaxAge: 60 });

    const { error } = await updateLimits({
      ...seededLimits,
      hostingCacheMaxAge: 0,
    });

    expect(error).toBeNull();
    expect(getLimits().hostingCacheMaxAge).toBe(0);
  });

  it("requires a signed-in user", async () => {
    session.user = null;

    const { error } = await updateLimits({
      ...seededLimits,
      maxUploadSize: 1024,
    });

    expect(error?.message).toBe("Unauthorized");
    expect(getLimits()).toEqual(seededLimits);
  });
});

describe("applyDefaultVisibility", () => {
  it("changes only the files that differ and reports how many", async () => {
    await upload("a.txt", "a", "public");
    await upload("b.txt", "b", "private");
    await upload("c.txt", "c", "public");

    const { data, error } = await applyDefaultVisibility("private");

    expect(error).toBeNull();
    expect(data?.updated).toBe(2);
    for (const key of ["a.txt", "b.txt", "c.txt"]) {
      expect(visibilityOf(key), key).toBe("private");
    }
  });

  it("rejects an unknown visibility", async () => {
    await upload("a.txt", "a", "public");

    const { error } = await applyDefaultVisibility("secret");

    expect(error?.message).toBe("Invalid visibility");
    expect(visibilityOf("a.txt")).toBe("public");
  });
});

describe("describeUserAgent", () => {
  it("names common browsers and systems", () => {
    const cases: [string, string][] = [
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "Chrome on Windows",
      ],
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
        "Edge on Windows",
      ],
      [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        "Safari on iOS",
      ],
      [
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        "Chrome on Android",
      ],
      [
        "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
        "Firefox on Linux",
      ],
      [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        "Safari on macOS",
      ],
      ["curl/8.5.0", "curl/8.5.0"],
    ];

    for (const [userAgent, expected] of cases) {
      expect(describeUserAgent(userAgent)).toBe(expected);
    }
    expect(describeUserAgent(null)).toBe("Unknown device");
  });
});

describe("formatIpAddress", () => {
  it("compresses expanded IPv6 and leaves everything else alone", () => {
    const cases: [string, string][] = [
      ["0000:0000:0000:0000:0000:0000:0000:0000", "::"],
      ["2001:0db8:85a3:0000:0000:0000:0000:0000", "2001:db8:85a3::"],
      ["fe80:0000:0000:0000:0000:0000:0000:0001", "fe80::1"],
      ["2001:0db8:0000:0001:0000:0000:0000:0001", "2001:db8:0:1::1"],
      ["2001:db8::1", "2001:db8::1"],
      ["203.0.113.7", "203.0.113.7"],
    ];

    for (const [ip, expected] of cases) {
      expect(formatIpAddress(ip), ip).toBe(expected);
    }
  });
});
