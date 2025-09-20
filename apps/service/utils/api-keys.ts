import db from "@/db";
import { ApiKey } from "@repo/types";
import crypto from "node:crypto";

export function validateApiKey(key: string): ApiKey | null {
  if (!key || typeof key !== "string") {
    return null;
  }

  // hash the incoming key to find it in the DB.
  const keyHash = hashKey(key);

  const stmt = db.prepare(`SELECT * FROM api_keys WHERE key_hash = ?`);

  const result = stmt.get(keyHash) as ApiKey | undefined;

  if (!result) return null;

  // check if the key has expired.
  if (result.expires_at && new Date(result.expires_at) < new Date()) {
    // delete the expired key.
    db.prepare("DELETE FROM api_keys WHERE key_hash = ?").run(keyHash);

    return null;
  }

  //  update the `last_used_at` timestamp.
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?").run(
    new Date().toISOString(),
    keyHash,
  );

  return result;
}

export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
