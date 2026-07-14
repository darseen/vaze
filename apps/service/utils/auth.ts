import { auth as betterAuth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Returns the currently signed-in user (`{ id, name, email, ... }`) or `null`.
 * Server-side helper used by server actions and RSC.
 */
export default async function auth() {
  try {
    const session = await betterAuth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
  } catch {
    return null;
  }
}
