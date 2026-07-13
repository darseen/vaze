import { BASE_DB_PATH, BASE_UPLOADS_PATH } from "@/constants";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export * as schema from "./schema";

/**
 * A singleton class that owns the SQLite connection and the Drizzle instance.
 * Migrations are applied once, synchronously, when the instance is created so
 * the schema is guaranteed to exist before any query runs.
 */
class DrizzleDB {
  private static instance: DrizzleDB;
  public db: ReturnType<typeof drizzle<typeof schema>>;
  public sqlite: Database.Database;

  private constructor() {
    const dbPath = path.join(BASE_DB_PATH, "vaze.db");

    // Ensure the directories for the database file and uploads exist.
    for (const dir of [path.dirname(dbPath), BASE_UPLOADS_PATH]) {
      try {
        fs.accessSync(dir, fs.constants.F_OK);
      } catch {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    try {
      this.sqlite = new Database(dbPath);
      console.log(`Successfully connected to the database at ${dbPath}`);

      // Enable Write-Ahead Logging for better concurrency.
      this.sqlite.pragma("journal_mode = WAL");
      // Enable foreign key support.
      this.sqlite.pragma("foreign_keys = ON");

      this.db = drizzle(this.sqlite, { schema });

      // Apply any pending migrations. The generated baseline (0000) uses
      // `CREATE TABLE IF NOT EXISTS`, so this is a safe no-op on pre-existing
      // volumes that were initialized before Drizzle was introduced.
      migrate(this.db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });

      this.seedRootFolder();
    } catch (error) {
      console.error("Error opening or initializing the database:", error);
      throw error;
    }
  }

  public static getInstance(): DrizzleDB {
    if (!DrizzleDB.instance) {
      DrizzleDB.instance = new DrizzleDB();
    }
    return DrizzleDB.instance;
  }

  /**
   * Insert the root uploads folder if it does not already exist. Matches the
   * previous behavior where the root folder row was seeded on every boot.
   */
  private seedRootFolder(): void {
    this.db
      .insert(schema.folders)
      .values({
        id: crypto.randomUUID(),
        name: path.basename(BASE_UPLOADS_PATH),
        path: BASE_UPLOADS_PATH,
      })
      .onConflictDoNothing()
      .run();
  }
}

// Export the shared Drizzle instance.
const db = DrizzleDB.getInstance().db;
export default db;
