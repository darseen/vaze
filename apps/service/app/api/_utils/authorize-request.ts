import db from "@/db";
import { validateApiKey } from "@/utils/api-keys";
import { verifyToken } from "@/utils/jwt";
import { User } from "@repo/types";
import { revalidatePath } from "next/cache";
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
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(key.user_id) as User | undefined;

    if (!user) {
      return { error: { message: "Unauthorized" }, data: null };
    }

    db.prepare(
      `INSERT INTO api_requests (id, user_id, key_id) VALUES (?, ?, ?)`,
    ).run(crypto.randomUUID(), user.id, key.id);

    revalidatePath("dashboard");
    return {
      error: null,
      data: { user: { id: user.id, username: user.username } },
    };
  }

  return { error: null, data: null };
}
