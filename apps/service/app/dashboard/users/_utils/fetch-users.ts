import { db } from "@/db";
import { isDisabled, isRole, parseScopes, scopesOf } from "@/lib/permissions";
import { apiKeys, users } from "@repo/db";
import type { Role, Scope } from "@repo/types";
import { asc, count } from "drizzle-orm";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** What the account can actually do. */
  scopes: Scope[];
  /** The picks saved for the custom role, kept to prefill the editor. */
  customScopes: Scope[];
  disabled: boolean;
  apiKeys: number;
  createdAt: string;
}

export default function fetchUsers() {
  try {
    const keyCounts = new Map(
      db
        .select({ userId: apiKeys.userId, total: count() })
        .from(apiKeys)
        .groupBy(apiKeys.userId)
        .all()
        .map((row) => [row.userId, row.total]),
    );

    const rows: UserRow[] = db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt))
      .all()
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        // a role Better Auth stored that the dashboard doesn't know reads as custom
        role: isRole(user.role) ? user.role : "custom",
        scopes: scopesOf(user),
        customScopes: parseScopes(user.scopes),
        disabled: isDisabled(user),
        apiKeys: keyCounts.get(user.id) ?? 0,
        createdAt: user.createdAt.toISOString(),
      }));

    return { data: { users: rows }, error: null };
  } catch (error) {
    console.log("fetch users error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
