import { relations, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { files } from "./files";
import { timestamps } from "./_shared";

export const folders = sqliteTable("folders", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  parentId: text("parent_id").references((): AnySQLiteColumn => folders.id, {
    onDelete: "cascade",
  }),
  ...timestamps,
});

export const foldersRelations = relations(folders, ({ one, many }) => ({
  // Self-referential parent / children. `relationName` disambiguates the two
  // sides of the same-table relation.
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "folder_tree",
  }),
  children: many(folders, { relationName: "folder_tree" }),
  files: many(files),
}));

export type Folder = InferSelectModel<typeof folders>;
