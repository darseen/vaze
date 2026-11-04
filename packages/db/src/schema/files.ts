import { relations, sql, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { timestamps } from "./_shared";
import { folders } from "./folders";

export const VISIBILITIES = ["public", "private"] as const;

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    mimeType: text("mime_type").notNull(),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    size: integer("size").notNull(),
    visibility: text("visibility", { enum: VISIBILITIES })
      .notNull()
      .default("public"),
    // set while the file waits in Recently deleted, under the .deleted area
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  // a deleted file keeps its key for the restore, so it must not block reuse
  (table) => [
    uniqueIndex("files_key_unique")
      .on(table.key)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("files_folder_id_name_unique")
      .on(table.folderId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index("files_folder_id_idx").on(table.folderId),
    index("files_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);

export const filesRelations = relations(files, ({ one }) => ({
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
}));

export type File = InferSelectModel<typeof files>;
export type Visibility = File["visibility"];
