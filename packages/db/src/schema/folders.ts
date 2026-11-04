import { relations, sql, type InferSelectModel } from "drizzle-orm";
import {
  index,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { files } from "./files";
import { timestamps } from "./_shared";

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    // POSIX path relative to the uploads root; the root folder itself is "".
    key: text("key").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => folders.id, {
      onDelete: "cascade",
    }),
    // set on a deleted folder and on everything that was inside it
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("folders_key_unique")
      .on(table.key)
      .where(sql`${table.deletedAt} IS NULL`),
    index("folders_parent_id_idx").on(table.parentId),
    index("folders_deleted_at_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} IS NOT NULL`),
  ],
);

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
