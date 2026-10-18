import { relations, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { files } from "./files";

// Public hosting traffic, rolled up per UTC day instead of one row per request.
export const hostingDays = sqliteTable("hosting_days", {
  // YYYY-MM-DD in UTC
  date: text("date").primaryKey().notNull(),
  // responses that served a file: 200, 206 and 304
  requests: integer("requests").notNull().default(0),
  // body bytes actually streamed out
  bytes: integer("bytes").notNull().default(0),
  // keys that matched no file the caller could read
  notFound: integer("not_found").notNull().default(0),
});

// The same rollup per file, so the dashboard can rank what is requested most.
export const hostingFileDays = sqliteTable(
  "hosting_file_days",
  {
    date: text("date").notNull(),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    requests: integer("requests").notNull().default(0),
    bytes: integer("bytes").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.fileId] }),
    // deleting a file cascades here by file_id, which the key can't look up
    index("hosting_file_days_file_id_idx").on(table.fileId),
  ],
);

export const hostingFileDaysRelations = relations(
  hostingFileDays,
  ({ one }) => ({
    file: one(files, {
      fields: [hostingFileDays.fileId],
      references: [files.id],
    }),
  }),
);

export type HostingDay = InferSelectModel<typeof hostingDays>;
export type HostingFileDay = InferSelectModel<typeof hostingFileDays>;
