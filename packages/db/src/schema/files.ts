import { relations, type InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { folders } from "./folders";
import { timestamps } from "./_shared";

export const files = sqliteTable("files", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  folderId: text("folder_id")
    .notNull()
    .references(() => folders.id, { onDelete: "cascade" }),
  size: integer("size").notNull(),
  ...timestamps,
});

export const filesRelations = relations(files, ({ one }) => ({
  folder: one(folders, {
    fields: [files.folderId],
    references: [folders.id],
  }),
}));

export type File = InferSelectModel<typeof files>;
