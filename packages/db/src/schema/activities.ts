import { relations, sql, type InferSelectModel } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

export const ACTIVITY_TYPES = [
  "upload.succeeded",
  "upload.failed",
  "upload.canceled",
  "file.deleted",
  "file.delete-failed",
  "folder.deleted",
  "folder.delete-failed",
  "api-key.created",
  "api-key.renamed",
  "api-key.deleted",
] as const;

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ACTIVITY_TYPES }).notNull(),
    // what the event happened to: a file name, "3 files", a key name
    target: text("target"),
    // free-form extra line, e.g. the error message that failed an upload
    detail: text("detail"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("activities_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export type Activity = InferSelectModel<typeof activities>;
export type ActivityType = Activity["type"];
