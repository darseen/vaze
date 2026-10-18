import { getFilesWithUrls } from "@/app/api/_utils";
import { BASE_DATA_PATH } from "@/constants";
import { db } from "@/db";
import { flushHostingTraffic } from "@/lib/hosting-traffic";
import { isDisabled } from "@/lib/permissions";
import {
  activities,
  apiKeys,
  apiRequests,
  files,
  folders,
  hostingDays,
  hostingFileDays,
  sessions,
  users,
} from "@repo/db";
import type {
  ApiKeyUsage,
  Scope,
  Stats,
  StatsAlert,
  Visibility,
} from "@repo/types";
import { parseTimestamp } from "@/utils";
import { getVolumeUsage } from "@/utils/storage";
import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;

const LIST_LIMIT = 5;
const REQUEST_DAYS = 7;
const TREND_DAYS = 30;

// alerts
const LOW_STORAGE_SHARE = 0.1;
// the keys pages flag a key as "expiring soon" within the same week
const EXPIRING_WITHIN_MS = 7 * DAY_MS;
const UNUSED_AFTER_MS = 30 * DAY_MS;

/** The last `days` UTC dates as YYYY-MM-DD, oldest first, ending today. */
function lastUtcDays(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, index) =>
    new Date(now - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

// the first UTC day of a window ending today; SQLite and the JS above agree on UTC
const windowStart = (days: number) => sql`date('now', ${`-${days - 1} days`})`;

async function fileStats(): Promise<NonNullable<Stats["files"]>> {
  const usage = db
    .select({ total: count(), used: sql<number | null>`sum(${files.size})` })
    .from(files)
    .get();

  const [{ value: folderCount }] = db
    .select({ value: count() })
    .from(folders)
    .all();

  const typeSize = sql<number>`sum(${files.size})`;
  const types = db
    .select({ mimeType: files.mimeType, size: typeSize, count: count() })
    .from(files)
    .groupBy(files.mimeType)
    .orderBy(desc(typeSize))
    .all();

  const largest = db
    .select()
    .from(files)
    .orderBy(desc(files.size))
    .limit(LIST_LIMIT)
    .all();

  const recent = db
    .select()
    .from(files)
    .orderBy(desc(files.createdAt))
    .limit(LIST_LIMIT)
    .all();

  const visibility: Record<Visibility, { count: number; size: number }> = {
    public: { count: 0, size: 0 },
    private: { count: 0, size: 0 },
  };
  const byVisibility = db
    .select({
      visibility: files.visibility,
      count: count(),
      size: sql<number>`sum(${files.size})`,
    })
    .from(files)
    .groupBy(files.visibility)
    .all();
  for (const row of byVisibility) {
    visibility[row.visibility] = { count: row.count, size: row.size };
  }

  const day = sql<string>`date(${files.createdAt})`;
  const addedRows = db
    .select({ day, count: count(), size: sql<number>`sum(${files.size})` })
    .from(files)
    .where(gte(files.createdAt, windowStart(TREND_DAYS)))
    .groupBy(day)
    .all();
  const addedByDay = new Map(addedRows.map((row) => [row.day, row]));
  const added = lastUtcDays(TREND_DAYS).map((date) => ({
    date,
    count: addedByDay.get(date)?.count ?? 0,
    size: addedByDay.get(date)?.size ?? 0,
  }));

  const { available, capacity } = await getVolumeUsage(BASE_DATA_PATH);

  return {
    total: usage?.total ?? 0,
    folders: folderCount,
    storage: { used: usage?.used ?? 0, available, capacity },
    types,
    largest: getFilesWithUrls(largest),
    recent: getFilesWithUrls(recent),
    visibility,
    added,
  };
}

type KeyRow = {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
};

function listKeyRows(userId: string): KeyRow[] {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      lastUsed: apiKeys.lastUsed,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .all();
}

function apiKeyStats(
  userId: string,
  keys: KeyRow[],
): NonNullable<Stats["apiKeys"]> {
  const inWindow = and(
    eq(apiRequests.userId, userId),
    gte(apiRequests.createdAt, windowStart(REQUEST_DAYS)),
  );

  const day = sql<string>`date(${apiRequests.createdAt})`;
  const daily = db
    .select({ day, value: count() })
    .from(apiRequests)
    .where(inWindow)
    .groupBy(day)
    .all();
  const byDay = new Map(daily.map((row) => [row.day, row.value]));
  const requests = lastUtcDays(REQUEST_DAYS).map((date) => ({
    date,
    count: byDay.get(date) ?? 0,
  }));

  const perKey = db
    .select({ keyId: apiRequests.keyId, value: count() })
    .from(apiRequests)
    .where(inWindow)
    .groupBy(apiRequests.keyId)
    .all();
  const byKey = new Map(perKey.map((row) => [row.keyId, row.value]));

  const usage: ApiKeyUsage[] = keys
    .map((key) => ({
      id: key.id,
      name: key.name,
      requests: byKey.get(key.id) ?? 0,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
    }))
    .sort((a, b) => b.requests - a.requests || a.name.localeCompare(b.name));

  return { total: keys.length, requests, keys: usage };
}

function hostingStats(): NonNullable<Stats["hosting"]> {
  // counts are buffered in memory, so save them before reading
  flushHostingTraffic();

  const start = windowStart(TREND_DAYS);

  const rows = db
    .select()
    .from(hostingDays)
    .where(gte(hostingDays.date, start))
    .all();
  const byDay = new Map(rows.map((row) => [row.date, row]));
  const days = lastUtcDays(TREND_DAYS).map((date) => ({
    date,
    requests: byDay.get(date)?.requests ?? 0,
    bytes: byDay.get(date)?.bytes ?? 0,
    notFound: byDay.get(date)?.notFound ?? 0,
  }));

  const requests = sql<number>`sum(${hostingFileDays.requests})`;
  const bytes = sql<number>`sum(${hostingFileDays.bytes})`;
  const ranked = db
    .select({ fileId: hostingFileDays.fileId, requests, bytes })
    .from(hostingFileDays)
    .where(gte(hostingFileDays.date, start))
    .groupBy(hostingFileDays.fileId)
    .orderBy(desc(requests), desc(bytes))
    .limit(LIST_LIMIT)
    .all();

  const rankedFiles =
    ranked.length > 0
      ? db
          .select()
          .from(files)
          .where(
            inArray(
              files.id,
              ranked.map((row) => row.fileId),
            ),
          )
          .all()
      : [];
  const fileById = new Map(
    getFilesWithUrls(rankedFiles).map((file) => [file.id, file]),
  );

  const top = ranked.flatMap((row) => {
    const file = fileById.get(row.fileId);
    return file ? [{ file, requests: row.requests, bytes: row.bytes }] : [];
  });

  return { days, top };
}

function userStats(): NonNullable<Stats["users"]> {
  const accounts = db
    .select({ banned: users.banned, banExpires: users.banExpires })
    .from(users)
    .all();

  const [{ value: liveSessions }] = db
    .select({ value: count() })
    .from(sessions)
    .where(gt(sessions.expiresAt, new Date()))
    .all();

  return {
    total: accounts.length,
    disabled: accounts.filter(isDisabled).length,
    sessions: liveSessions,
  };
}

function failureAlerts(userId: string): StatsAlert[] {
  const rows = db
    .select({
      type: activities.type,
      count: count(),
      latest: sql<string>`max(${activities.createdAt})`,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        inArray(activities.type, [
          "upload.failed",
          "file.delete-failed",
          "folder.delete-failed",
        ]),
        gte(activities.createdAt, sql`datetime('now', '-7 days')`),
      ),
    )
    .groupBy(activities.type)
    .all();

  const alerts: StatsAlert[] = [];

  const uploads = rows.find((row) => row.type === "upload.failed");
  if (uploads) {
    alerts.push({
      type: "uploads-failed",
      count: uploads.count,
      latest: uploads.latest,
    });
  }

  const deletes = rows.filter((row) => row.type !== "upload.failed");
  if (deletes.length > 0) {
    alerts.push({
      type: "deletes-failed",
      count: deletes.reduce((sum, row) => sum + row.count, 0),
      // CURRENT_TIMESTAMP strings sort chronologically
      latest: deletes
        .map((row) => row.latest)
        .sort()
        .at(-1)!,
    });
  }

  return alerts;
}

function keyAlerts(keys: KeyRow[]): StatsAlert[] {
  const now = Date.now();
  let expired = 0;
  let expiring = 0;
  let unused = 0;

  for (const key of keys) {
    const expiresAt = key.expiresAt
      ? parseTimestamp(key.expiresAt).getTime()
      : null;

    if (expiresAt !== null && expiresAt <= now) {
      expired += 1;
      continue;
    }
    if (expiresAt !== null && expiresAt <= now + EXPIRING_WITHIN_MS) {
      expiring += 1;
    }

    // a key never used counts from when it was made
    const lastActive = parseTimestamp(key.lastUsed ?? key.createdAt).getTime();
    if (now - lastActive >= UNUSED_AFTER_MS) unused += 1;
  }

  const alerts: StatsAlert[] = [];
  if (expired > 0) alerts.push({ type: "keys-expired", count: expired });
  if (expiring > 0) alerts.push({ type: "keys-expiring", count: expiring });
  if (unused > 0) alerts.push({ type: "keys-unused", count: unused });
  return alerts;
}

export interface StatsCaller {
  userId: string;
  scopes: Scope[];
  /** Activity is only shared with a signed-in session, like `/api/activity`. */
  session: boolean;
}

/** What the dashboard shows, limited to what the caller may see. */
export async function getStats({
  userId,
  scopes,
  session,
}: StatsCaller): Promise<Stats> {
  const canReadFiles = scopes.includes("files:read");

  const fileData = canReadFiles ? await fileStats() : null;
  const keys = scopes.includes("api-keys:manage") ? listKeyRows(userId) : null;

  const alerts: StatsAlert[] = [];

  const storage = fileData?.storage;
  if (
    storage?.capacity &&
    storage.available < storage.capacity * LOW_STORAGE_SHARE
  ) {
    alerts.push({
      type: "storage-low",
      available: storage.available,
      capacity: storage.capacity,
    });
  }
  if (session) alerts.push(...failureAlerts(userId));
  if (keys) alerts.push(...keyAlerts(keys));

  return {
    files: fileData,
    apiKeys: keys ? apiKeyStats(userId, keys) : null,
    hosting: canReadFiles ? hostingStats() : null,
    users: scopes.includes("users:manage") ? userStats() : null,
    alerts,
  };
}
