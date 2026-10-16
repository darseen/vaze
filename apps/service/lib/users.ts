import { db } from "@/db";
import {
  isDisabled,
  isRole,
  normalizeScopes,
  parseScopes,
  ROLE_INFO,
  SCOPE_INFO,
  scopesOf,
} from "@/lib/permissions";
import { apiKeys, users } from "@repo/db";
import type { Role, User, UserSummary } from "@repo/types";
import { asc, count, eq } from "drizzle-orm";

function toSummary(user: User, keyCount: number): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    // a role Better Auth stored that the dashboard doesn't know reads as custom
    role: isRole(user.role) ? user.role : "custom",
    scopes: scopesOf(user),
    customScopes: parseScopes(user.scopes),
    disabled: isDisabled(user),
    apiKeys: keyCount,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Every account, oldest first. */
/** Whether anyone has registered; until then the instance is waiting for its admin. */
export function hasAccounts() {
  return Boolean(db.select({ id: users.id }).from(users).limit(1).get());
}

export function listUsers(): UserSummary[] {
  const keyCounts = new Map(
    db
      .select({ userId: apiKeys.userId, total: count() })
      .from(apiKeys)
      .groupBy(apiKeys.userId)
      .all()
      .map((row) => [row.userId, row.total]),
  );

  return db
    .select()
    .from(users)
    .orderBy(asc(users.createdAt))
    .all()
    .map((user) => toSummary(user, keyCounts.get(user.id) ?? 0));
}

export function getUserSummary(id: string): UserSummary | null {
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) return null;

  const [{ total }] = db
    .select({ total: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, id))
    .all();

  return toSummary(user, total);
}

/** The role plus the comma-joined scopes stored with it, or an error. */
export function parseAccess(
  input: { role?: unknown; scopes?: unknown } | undefined,
):
  | { role: Role; scopes: string | null; error: null }
  | { role: null; scopes: null; error: string } {
  if (!isRole(input?.role)) {
    return { role: null, scopes: null, error: "Pick a valid role" };
  }

  if (input.role !== "custom") {
    return { role: input.role, scopes: null, error: null };
  }

  const scopes = normalizeScopes(input.scopes);

  if (scopes.length === 0) {
    return {
      role: null,
      scopes: null,
      error: "Pick at least one scope for a custom role",
    };
  }

  return { role: "custom", scopes: scopes.join(","), error: null };
}

/** How a role reads in history, e.g. "Editor" or "Custom: View files". */
export function describeAccess(role: Role, scopes: string | null) {
  if (role !== "custom") return ROLE_INFO[role].label;

  const labels = normalizeScopes(scopes?.split(",") ?? []).map(
    (scope) => SCOPE_INFO[scope].label,
  );
  return `Custom: ${labels.join(", ")}`;
}

export function findUser(id: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      scopes: users.scopes,
    })
    .from(users)
    .where(eq(users.id, id))
    .get();
}
