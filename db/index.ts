import sqlite3 from "sqlite3";
import path from "node:path";
import fs from "node:fs";
import { BASE_DB_PATH } from "@/constants";

/**
 * A singleton class to manage the SQLite database connection and initialization.
 * This ensures that there is only one instance of the database connection
 * throughout the application's lifecycle.
 */
class SQLiteDB {
  private static instance: SQLiteDB; // The single, static instance of the class.
  public db: sqlite3.Database; // The public database object for running queries.

  /**
   * 2. The constructor is private to prevent creating new instances with `new SQLiteDB()`.
   * It connects to the database and calls the initialization method.
   */
  private constructor() {
    const sqlite = sqlite3.verbose();
    const dbPath = path.join(BASE_DB_PATH, "vaze.db");

    // check if path exists
    try {
      fs.accessSync(dbPath, fs.constants.F_OK);
    } catch {
      // create the directory if it doesn't exist
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    // The database connection is established. The callback handles success or failure.
    this.db = new sqlite.Database(dbPath, (error) => {
      if (error) {
        // Log the error and exit if the DB can't be opened.
        console.error("Error opening database:", error.message);
        throw error;
      }
      console.log(`Successfully connected to the database at ${dbPath}`);
      // 4. Initialize the database schema once the connection is successful.
      this.initializeSchema();
    });
  }

  /**
   * 3. The static `getInstance` method provides the single point of access.
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
   * It's called automatically from the constructor.
   */
  private initializeSchema(): void {
    const filesTableSQL = `
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT UNIQUE NOT NULL,
                folder_name TEXT NOT NULL,
                encoding TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

    const usersTableSQL = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

    this.db.run(filesTableSQL, (error) => {
      if (error) {
        console.error("Error creating table files:", error.message);
        throw error;
      }
    });
    this.db.run(usersTableSQL, (error) => {
      if (error) {
        console.error("Error creating table users:", error.message);
        throw error;
      }
    });
  }
}

const db = SQLiteDB.getInstance().db;
export default db;
