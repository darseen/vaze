"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function signOut() {
  try {
    // Clears the session row and cookie (via the nextCookies plugin).
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Already signed out / no valid session — treat as success so the client
    // still navigates away.
  }

  return { data: {}, error: null, status: 200 };
}
