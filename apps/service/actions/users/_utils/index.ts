import { db } from "@/db";
import {
  isRole,
  normalizeScopes,
  ROLE_INFO,
  SCOPE_INFO,
} from "@/lib/permissions";
import { users, type Role } from "@repo/db";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

export interface AccessInput {
  role: string;
  scopes: string[];
}

/** The role plus the comma-joined scopes stored with it, or null if invalid. */
export function parseAccess(
  input: AccessInput | undefined,
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

export function actionError(error: unknown, fallback: string) {
  if (error instanceof APIError) {
    return { error: { message: error.body?.message ?? fallback }, data: null };
  }

  console.log(`${fallback.toLowerCase()} error`, error);
  return { error: { message: "Something went wrong" }, data: null };
}
