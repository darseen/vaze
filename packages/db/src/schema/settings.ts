import { type InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { VISIBILITIES } from "./files";
import { timestamps } from "./_shared";

// Instance-wide settings, stored as a single row.
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  defaultVisibility: text("default_visibility", { enum: VISIBILITIES })
    .notNull()
    .default("public"),
  // limits are null until seeded from their env vars on boot
  maxUploadSize: integer("max_upload_size"),
  defaultPresignTtl: integer("default_presign_ttl"),
  maxPresignTtl: integer("max_presign_ttl"),
  hostingCacheMaxAge: integer("hosting_cache_max_age"),
  activityRetentionDays: integer("activity_retention_days"),
  apiRequestRetentionDays: integer("api_request_retention_days"),
  ...timestamps,
});

export type Settings = InferSelectModel<typeof settings>;
