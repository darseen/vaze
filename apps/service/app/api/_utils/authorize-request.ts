import { db } from "@/db";
import { apiRequests, users } from "@repo/db";
import { auth } from "@/lib/auth";
import {
  hasScope,
  isDisabled,
  parseKeyScopes,
  scopesOf,
} from "@/lib/permissions";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import type { Scope } from "@repo/types";
import { validateApiKey } from "@/utils/api-keys";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

interface AuthorizedUser {
  id: string;
  username: string;
}

type AuthorizeResult =
  | {
      error: null;
      data: {
        user: AuthorizedUser;
        scopes: Scope[];
        /** Null when the request used an API key. */
        sessionId: string | null;
      };
    }
  | {
      error: { message: string; status: number; retryAfter?: number };
      data: null;
    };

const unauthorized: AuthorizeResult = {
  error: { message: "Unauthorized", status: 401 },
  data: null,
};

function forbidden(scope: Scope, holder?: string): AuthorizeResult {
  const message = holder
    ? `${holder} is missing required scope "${scope}"`
    : `Missing required scope "${scope}"`;
  return { error: { message, status: 403 }, data: null };
}

export default async function authorizeRequest(
  request: NextRequest,
  {
    scope,
    // a separate bucket keeps a burst of previews from locking out the API
    bucket = "api",
    limit: max = 300,
    // for endpoints that act on the account itself rather than its files
    session: sessionOnly = false,
  }: { scope?: Scope; bucket?: string; limit?: number; session?: boolean },
): Promise<AuthorizeResult> {
  const limit = rateLimit(bucket, clientIp(request), {
    limit: max,
    windowMs: 60_000,
  });

  if (!limit.ok) {
    return {
      error: {
        message: "Too many requests",
        status: 429,
        retryAfter: limit.retryAfter,
      },
      data: null,
    };
  }

  // authorize the request using an api key or the Better Auth session cookie
  const apiKey = request.headers.get("API-Key");

  // Check the key first: `getSession` costs a DB round trip, and a keyed
  // request never carries a session cookie.
  if (apiKey) {
    if (sessionOnly) {
      return {
        error: {
          message: "This endpoint needs a signed-in session",
          status: 403,
        },
        data: null,
      };
    }

    const key = validateApiKey(apiKey);
    if (!key) return unauthorized;

    const user = db.select().from(users).where(eq(users.id, key.userId)).get();

    if (!user || isDisabled(user)) return unauthorized;

    // request logging is best-effort — a busy DB must not fail a valid request
    try {
      db.insert(apiRequests)
        .values({ id: crypto.randomUUID(), userId: user.id, keyId: key.id })
        .run();
    } catch (error) {
      console.error("failed to log api request", error);
    }

    // keys only work while their owner may hold them
    if (!hasScope(user, "api-keys:manage")) return forbidden("api-keys:manage");

    const keyScopes = parseKeyScopes(key.scopes);
    if (scope && !hasScope(user, scope)) return forbidden(scope);
    if (scope && !keyScopes.includes(scope)) {
      return forbidden(scope, "API key");
    }

    return {
      error: null,
      data: {
        user: { id: user.id, username: user.name },
        scopes: scopesOf(user).filter((held) => keyScopes.includes(held)),
        sessionId: null,
      },
    };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (session) {
    if (scope && !hasScope(session.user, scope)) return forbidden(scope);

    return {
      error: null,
      data: {
        user: { id: session.user.id, username: session.user.name },
        scopes: scopesOf(session.user),
        sessionId: session.session.id,
      },
    };
  }

  // No api key and no session.
  return unauthorized;
}
