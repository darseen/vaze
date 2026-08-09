import { relations, type InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { folders } from "./folders";
import { timestamps } from "./_shared";

export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    // POSIX path relative to the uploads root — both the public object key and
    // the disk locator. Never store an absolute path.
    key: text("key").notNull(),
    mimeType: text("mime_type").notNull(),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    size: integer("size").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("files_key_unique").on(table.key),
    uniqueIndex("files_folder_id_name_unique").on(table.folderId, table.name),
    index("files_folder_id_idx").on(table.folderId),
  ],
);

export const filesRelations = relations(files, ({ one }) => ({
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
}));

export type File = InferSelectModel<typeof files>;
