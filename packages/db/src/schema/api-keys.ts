import { relations, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { apiRequests } from "./api-requests";
import { users } from "./auth";
import { timestamps } from "./_shared";

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull().unique(),
    lastUsed: text("last_used"),
    expiresAt: text("expires_at"),
    ...timestamps,
  },
  // names only need to be unique per user
  (table) => [
    uniqueIndex("api_keys_user_id_name_unique").on(table.userId, table.name),
  ],
);

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  requests: many(apiRequests),
}));

export type ApiKey = InferSelectModel<typeof apiKeys>;
