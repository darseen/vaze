import { db } from "@/db";
import { apiRequests, users } from "@repo/db";
import { auth } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { validateApiKey } from "@/utils/api-keys";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

interface AuthorizedUser {
  id: string;
  username: string;
}

type AuthorizeResult =
  | { error: null; data: { user: AuthorizedUser } }
  | { error: { message: string; status: number }; data: null };

const unauthorized: AuthorizeResult = {
  error: { message: "Unauthorized", status: 401 },
  data: null,
};

export default async function authorizeRequest(
  request: NextRequest,
): Promise<AuthorizeResult> {
  const limit = rateLimit("api", clientIp(request), {
    limit: 300,
    windowMs: 60_000,
  });

  if (!limit.ok) {
    return {
      error: { message: "Too many requests", status: 429 },
      data: null,
    };
  }

  // authorize the request using an api key or the Better Auth session cookie
  const apiKey = request.headers.get("API-Key");

  // Check the key first: `getSession` costs a DB round trip, and a keyed
  // request never carries a session cookie.
  if (apiKey) {
    const key = validateApiKey(apiKey);
    if (!key) return unauthorized;

    const user = db.select().from(users).where(eq(users.id, key.userId)).get();

    if (!user) return unauthorized;

    // request logging is best-effort — a busy DB must not fail a valid request
    try {
      db.insert(apiRequests)
        .values({ id: crypto.randomUUID(), userId: user.id, keyId: key.id })
        .run();
    } catch (error) {
      console.error("failed to log api request", error);
    }

    return {
      error: null,
      data: { user: { id: user.id, username: user.name } },
    };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    return {
      error: null,
      data: { user: { id: session.user.id, username: session.user.name } },
    };
  }

  // No api key and no session.
  return unauthorized;
}
