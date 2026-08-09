import { relations, type InferSelectModel } from "drizzle-orm";
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
    ...timestamps,
  },
  (table) => [
    uniqueIndex("folders_key_unique").on(table.key),
    index("folders_parent_id_idx").on(table.parentId),
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
