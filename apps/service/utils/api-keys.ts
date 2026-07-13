import db from "@/db";
import { apiKeys } from "@/db/schema";
import { ApiKey } from "@repo/types";
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
    .where(eq(apiKeys.key_hash, keyHash))
    .get();

  if (!result) return null;

  // check if the key has expired.
  if (result.expires_at && new Date(result.expires_at) < new Date()) {
    // delete the expired key.
    db.delete(apiKeys).where(eq(apiKeys.key_hash, keyHash)).run();

    return null;
  }

  //  update the `last_used` timestamp.
  db.update(apiKeys)
    .set({ last_used: new Date().toISOString() })
    .where(eq(apiKeys.key_hash, keyHash))
    .run();

  return result;
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
