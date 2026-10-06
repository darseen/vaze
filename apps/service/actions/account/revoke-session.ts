"use server";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { sessions } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/** Sign out one of the admin's other devices. */
export default async function revokeSession(sessionId: string) {
  const requestHeaders = await headers();
  const current = await auth.api.getSession({ headers: requestHeaders });

  if (!current) return { error: { message: "Unauthorized" }, data: null };

  if (sessionId === current.session.id) {
    return {
      error: { message: "Use Sign out to end this session" },
      data: null,
    };
  }

  try {
    // the client only ever sees session ids, never their tokens
    const target = db
      .select({ token: sessions.token })
      .from(sessions)
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, current.user.id)),
      )
      .get();

    if (!target) return { error: { message: "Session not found" }, data: null };

    await auth.api.revokeSession({
      body: { token: target.token },
      headers: requestHeaders,
    });

    revalidatePath("/dashboard/settings");
    return { error: null, data: {} };
  } catch (error) {
    console.log("revoke session error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
