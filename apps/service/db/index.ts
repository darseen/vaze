import { BASE_DB_PATH, BASE_UPLOADS_PATH } from "@/constants";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@repo/db";

export * as schema from "@repo/db";

const dbPath = path.join(BASE_DB_PATH, "vaze.db");

// Ensure the directories for the database file and uploads exist.
for (const dir of [path.dirname(dbPath), BASE_UPLOADS_PATH]) {
  try {
    fs.accessSync(dir, fs.constants.F_OK);
  } catch {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const sqlite = new Database(dbPath);

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

// Insert the root uploads folder if it does not already exist.
db.insert(schema.folders)
  .values({
    id: crypto.randomUUID(),
    name: path.basename(BASE_UPLOADS_PATH),
    path: BASE_UPLOADS_PATH,
  })
  .onConflictDoNothing()
  .run();
