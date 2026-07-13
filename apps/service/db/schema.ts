import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Column/property names are kept in snake_case so that the objects Drizzle
// returns line up 1:1 with the shared `@repo/types` shapes (File, Folder, User,
// ApiKey, ApiRequest) and existing consumers keep working unchanged.

const timestamps = {
  created_at: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  parent_id: text("parent_id").references((): AnySQLiteColumn => folders.id, {
    onDelete: "cascade",
  }),
  ...timestamps,
});

export const files = sqliteTable("files", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  folder_id: text("folder_id")
    .notNull()
    .references(() => folders.id, { onDelete: "cascade" }),
  size: integer("size").notNull(),
  ...timestamps,
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  username: text("username").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  ...timestamps,
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull().unique(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key_hash: text("key_hash").notNull().unique(),
  last_used: text("last_used"),
  expires_at: text("expires_at"),
  ...timestamps,
});

export const apiRequests = sqliteTable("api_requests", {
  id: text("id").primaryKey().notNull(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key_id: text("key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  created_at: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});
