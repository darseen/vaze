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
  ...timestamps,
});

export type Settings = InferSelectModel<typeof settings>;
