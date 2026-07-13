import db from "@/db";
import { apiRequests, users } from "@/db/schema";
import { validateApiKey } from "@/utils/api-keys";
import { verifyToken } from "@/utils/jwt";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

export default async function authorizeRequest(request: NextRequest) {
  // authorize the request using the jwt token or an api key
  const token = request.cookies.get("token")?.value;
  const apiKey = request.headers.get("API-Key");

  if (!token && !apiKey) {
    return { error: { message: "Unauthorized" }, data: null };
  } else if (token) {
    const payload = await verifyToken(token);
    if (!payload) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    return { error: null, data: { user: payload.user } };
  } else if (apiKey) {
    const key = validateApiKey(apiKey);
    if (!key) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    const user = db
      .select()
      .from(users)
      .where(eq(users.id, key.user_id))
      .get();

    if (!user) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    db.insert(apiRequests)
      .values({ id: crypto.randomUUID(), user_id: user.id, key_id: key.id })
      .run();

    return {
      error: null,
      data: { user: { id: user.id, username: user.username } },
    };
  }

  // Should be unreachable, but never fall through as "authorized".
  return { error: { message: "Unauthorized" }, data: null };
}
