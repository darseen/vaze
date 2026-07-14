import { db } from "@/db";
import { apiKeys } from "@repo/db";
import type { ApiKey } from "@repo/types";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

export function validateApiKey(key: string): ApiKey | null {
  if (!key || typeof key !== "string") {
    return null;
  }

  // hash the incoming key to find it in the DB.
  const keyHash = hashKey(key);

  const result = db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .get();

  if (!result) return null;

  // check if the key has expired.
  if (result.expiresAt && new Date(result.expiresAt) < new Date()) {
    // delete the expired key.
    db.delete(apiKeys).where(eq(apiKeys.keyHash, keyHash)).run();

    return null;
  }

  //  update the `lastUsed` timestamp.
  db.update(apiKeys)
    .set({ lastUsed: new Date().toISOString() })
    .where(eq(apiKeys.keyHash, keyHash))
    .run();

  return result;
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
