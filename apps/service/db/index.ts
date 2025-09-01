import { BASE_DB_PATH } from "@/constants";
import Database from "better-sqlite3";
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
      // The database connection is established synchronously.
      this.db = new Database(dbPath);
      console.log(`Successfully connected to the database at ${dbPath}`);

      // Enable Write-Ahead Logging for better concurrency.
      this.db.pragma("journal_mode = WAL");

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
   * `better-sqlite3`'s `exec` method can run multiple SQL statements at once.
   */
  private initializeSchema(): void {
    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT UNIQUE NOT NULL,
          bucket TEXT NOT NULL,
          size INTEGER NOT NULL, 
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      // Execute all table creation statements in one go.
      this.db.exec(schemaSQL);
    } catch (error) {
      console.error("Error initializing database schema:", error);
      throw error;
    }
  }
}

// Export the single, shared instance of the database connection.
const db = SQLiteDB.getInstance().db;
export default db;

export type User = {
  id: string;
  username: string;
  password_hash: string;
  createdAt: Date;
};

export type File = {
  id: string;
  name: string;
  bucket: string;
  size: number;
  created_at: Date;
};
