import {
  ACTIVITY_RETENTION_DAYS,
  API_REQUEST_RETENTION_DAYS,
  BASE_DB_PATH,
  BASE_TMP_PATH,
  BASE_UPLOADS_PATH,
  DEFAULT_FILE_VISIBILITY,
  DEFAULT_PRESIGN_TTL_SECONDS,
  HOSTING_CACHE_MAX_AGE,
  MAX_PRESIGN_TTL_SECONDS,
  MAX_UPLOAD_SIZE,
} from "@/constants";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@repo/db";

export * as schema from "@repo/db";

/** Primary key of the single row in the `settings` table. */
export const SETTINGS_ID = 1;

const dbPath = path.join(BASE_DB_PATH, "vaze.db");

// Ensure the directories for the database file, uploads and upload staging exist.
for (const dir of [path.dirname(dbPath), BASE_UPLOADS_PATH, BASE_TMP_PATH]) {
  fs.mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// better-sqlite3 is synchronous with a single writer; without a busy timeout
// concurrent writes throw SQLITE_BUSY instead of waiting their turn.
sqlite.pragma("busy_timeout = 5000");
// Safe to relax under WAL: a crash can lose the last commit, never the database.
sqlite.pragma("synchronous = NORMAL");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

// Insert the root uploads folder if it does not already exist.
db.insert(schema.folders)
  .values({
    id: crypto.randomUUID(),
    name: path.basename(BASE_UPLOADS_PATH),
    key: "",
    parentId: null,
  })
  .onConflictDoNothing()
  .run();

// Env vars only seed the settings; after that the dashboard owns them.
const settingsSeed = {
  maxUploadSize: MAX_UPLOAD_SIZE,
  defaultPresignTtl: DEFAULT_PRESIGN_TTL_SECONDS,
  maxPresignTtl: MAX_PRESIGN_TTL_SECONDS,
  hostingCacheMaxAge: HOSTING_CACHE_MAX_AGE,
  activityRetentionDays: ACTIVITY_RETENTION_DAYS,
  apiRequestRetentionDays: API_REQUEST_RETENTION_DAYS,
};

db.insert(schema.settings)
  .values({
    id: SETTINGS_ID,
    defaultVisibility: DEFAULT_FILE_VISIBILITY,
    ...settingsSeed,
  })
  .onConflictDoNothing()
  .run();

// columns added after the row was created start out null
db.update(schema.settings)
  .set(
    Object.fromEntries(
      (Object.keys(settingsSeed) as (keyof typeof settingsSeed)[]).map(
        (column) => [
          column,
          sql`coalesce(${schema.settings[column]}, ${settingsSeed[column]})`,
        ],
      ),
    ),
  )
  .where(eq(schema.settings.id, SETTINGS_ID))
  .run();

function getSetting<K extends keyof typeof settingsSeed>(column: K): number {
  const row = db
    .select({ value: schema.settings[column] })
    .from(schema.settings)
    .where(eq(schema.settings.id, SETTINGS_ID))
    .get();

  return row?.value ?? settingsSeed[column];
}

// Uploads staged by a request that died mid-flight are never reclaimed by the
// request itself, so sweep whatever is left behind on boot.
function clearUploadStaging() {
  try {
    for (const entry of fs.readdirSync(BASE_TMP_PATH)) {
      fs.rmSync(path.join(BASE_TMP_PATH, entry), {
        recursive: true,
        force: true,
      });
    }
  } catch (error) {
    console.error("failed to clear upload staging", error);
  }
}

// One row per API call, so the table grows without bound unless it is pruned.
function pruneApiRequests() {
  try {
    db.run(
      sql`DELETE FROM api_requests WHERE created_at < datetime('now', ${`-${getSetting("apiRequestRetentionDays")} days`})`,
    );
  } catch (error) {
    console.error("failed to prune api_requests", error);
  }
}

// Activity history is append-only, so it needs the same treatment.
function pruneActivities() {
  try {
    db.run(
      sql`DELETE FROM activities WHERE created_at < datetime('now', ${`-${getSetting("activityRetentionDays")} days`})`,
    );
  } catch (error) {
    console.error("failed to prune activities", error);
  }
}

export function pruneHistory() {
  pruneApiRequests();
  pruneActivities();
}

clearUploadStaging();
pruneHistory();

const DAY_MS = 24 * 60 * 60 * 1000;
setInterval(pruneHistory, DAY_MS).unref();
