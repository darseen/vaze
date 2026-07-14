import { auth as betterAuth } from "@/lib/auth";
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
