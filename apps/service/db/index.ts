import { BASE_DB_PATH, BASE_UPLOADS_PATH } from "@/constants";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * A singleton class to manage the SQLite database connection and initialization
 * using the `better-sqlite3` library. This ensures that there is only one
 * instance of the database connection throughout the application's lifecycle.
 */
class SQLiteDB {
  private static instance: SQLiteDB;
  public db: Database.Database; // The public database object from better-sqlite3.

  /**
   * The constructor is private to prevent creating new instances with `new SQLiteDB()`.
   * It synchronously connects to the database and initializes the schema.
   */
  private constructor() {
    const dbPath = path.join(BASE_DB_PATH, "vaze.db");

    // Ensure the directory for the database file exists.
    try {
      fs.accessSync(path.dirname(dbPath), fs.constants.F_OK);
    } catch {
      // Create the directory if it doesn't exist.
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    try {
      fs.accessSync(BASE_UPLOADS_PATH, fs.constants.F_OK);
    } catch {
      // Create the uploads directory if it doesn't exist.
      fs.mkdirSync(BASE_UPLOADS_PATH, { recursive: true });
    }

    try {
      // The database connection is established synchronously.
      this.db = new Database(dbPath);
      console.log(`Successfully connected to the database at ${dbPath}`);

      // Enable Write-Ahead Logging for better concurrency.
      this.db.pragma("journal_mode = WAL");
      // Enable foreign key support.
      this.db.pragma("foreign_keys = ON");
      // Initialize the database schema.
      this.initializeSchema();
    } catch (error) {
      // Log the error and re-throw if the DB can't be opened or initialized.
      console.error("Error opening or initializing the database:", error);
      throw error;
    }
  }

  /**
   * The static `getInstance` method provides the single point of access.
   * It creates the instance if it doesn't exist, or returns the existing one.
   */
  public static getInstance(): SQLiteDB {
    if (!SQLiteDB.instance) {
      SQLiteDB.instance = new SQLiteDB();
    }
    return SQLiteDB.instance;
  }

  /**
   * A private method to create the necessary tables.
   */
  private initializeSchema(): void {
    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY NOT NULL UNIQUE,
          name TEXT UNIQUE NOT NULL,
          path TEXT NOT NULL,
          folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
          size INTEGER NOT NULL, 
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY NOT NULL UNIQUE,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL UNIQUE,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY NOT NULL UNIQUE,
          name TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key_hash TEXT NOT NULL UNIQUE,
          last_used TIMESTAMP,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_requests (
          id TEXT PRIMARY KEY NOT NULL UNIQUE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      // Execute all table creation statements in one go.
      this.db.exec(schemaSQL);
      // insert root folder
      this.db
        .prepare(
          `INSERT OR IGNORE INTO folders (id, name, path) VALUES (?, ?, ?)`,
        )
        .run(
          crypto.randomUUID(),
          path.basename(BASE_UPLOADS_PATH),
          BASE_UPLOADS_PATH,
        );
    } catch (error) {
      console.error("Error initializing database schema:", error);
      throw error;
    }
  }
}

// Export the single, shared instance of the database connection.
const db = SQLiteDB.getInstance().db;
export default db;
