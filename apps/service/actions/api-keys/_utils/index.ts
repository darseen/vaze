import db from "@/db";
import { hashKey } from "@/utils/api-keys";
import crypto from "node:crypto";

export function createApiKey(
  userId: string,
  name: string,
  expiresAt: Date | null,
): { id: string; name: string; key: string; createdAt: string } {
  // generate random string for the key.
  const key = `vz_${crypto.randomBytes(32).toString("hex")}`;

  // create a secure hash of the key for database storage.
  const keyHash = hashKey(key);

  // prepare the data for insertion.
  const keyId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // store the key hash and metadata in the database.
  const stmt = db.prepare(
    "INSERT INTO api_keys (id, name, user_id, key_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  stmt.run(keyId, name, userId, keyHash, createdAt, expiresAt?.toISOString());

  return {
    id: keyId,
    name,
    key,
    createdAt,
  };
}
