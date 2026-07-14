import { relations, sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { apiKeys } from "./api-keys";
import { users } from "./auth";

export const apiRequests = sqliteTable("api_requests", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  keyId: text("key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const apiRequestsRelations = relations(apiRequests, ({ one }) => ({
  user: one(users, {
    fields: [apiRequests.userId],
    references: [users.id],
  }),
  key: one(apiKeys, {
    fields: [apiRequests.keyId],
    references: [apiKeys.id],
  }),
}));

export type ApiRequest = InferSelectModel<typeof apiRequests>;
