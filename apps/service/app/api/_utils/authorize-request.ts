import { db } from "@/db";
import { apiRequests, users } from "@repo/db";
import { auth } from "@/lib/auth";
import { validateApiKey } from "@/utils/api-keys";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

export default async function authorizeRequest(request: NextRequest) {
  // authorize the request using the Better Auth session cookie or an api key
  const apiKey = request.headers.get("API-Key");

  // Session auth (dashboard / browser) takes precedence when a cookie is present.
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    return {
      error: null,
      data: { user: { id: session.user.id, username: session.user.name } },
    };
  }

  if (apiKey) {
    const key = validateApiKey(apiKey);
    if (!key) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    const user = db
      .select()
      .from(users)
      .where(eq(users.id, key.userId))
      .get();

    if (!user) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    db.insert(apiRequests)
      .values({ id: crypto.randomUUID(), userId: user.id, keyId: key.id })
      .run();

    return {
      error: null,
      data: { user: { id: user.id, username: user.name } },
    };
  }

  // No session and no api key.
  return { error: { message: "Unauthorized" }, data: null };
}
