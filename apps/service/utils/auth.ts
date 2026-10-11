import { auth as betterAuth } from "@/lib/auth";
import { hasScope } from "@/lib/permissions";
import type { Scope } from "@repo/types";
import { headers } from "next/headers";

export default async function auth() {
  try {
    const session = await betterAuth.api.getSession({
      headers: await headers(),
    });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user, or an error when there is none or it lacks the scope. */
export async function authorize(scope: Scope) {
  const user = await auth();

  if (!user) return { user: null, error: { message: "Unauthorized" } } as const;

  if (!hasScope(user, scope)) {
    return {
      user: null,
      error: { message: "You don't have permission to do that" },
    } as const;
  }

  return { user, error: null } as const;
}
