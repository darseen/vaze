import { sql } from "drizzle-orm";
import {
  AnySQLiteColumn,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Domain tables (folders, files, api_keys, api_requests) keep snake_case for
// both column and property names so the objects Drizzle returns line up 1:1
// with the shared `@repo/types` shapes (File, Folder, ApiKey, ApiRequest).
//
// The auth tables (users, sessions, accounts, verifications) are owned by
// Better Auth. They follow Better Auth's own convention instead — camelCase
// properties mapped to snake_case columns, millisecond-integer timestamps — so
// the Drizzle adapter maps its model fields onto them with no extra config.

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

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey().notNull(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ---------------------------------------------------------------------------

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
