import { db } from "@/db";
import { apiKeys } from "@repo/db";
import type { Scope } from "@repo/types";
import { hashKey } from "@/utils/api-keys";
import crypto from "node:crypto";

export function createApiKey(
  userId: string,
  name: string,
  expiresAt: Date | null,
  scopes: Scope[],
): { id: string; name: string; key: string; createdAt: string } {
  // generate random string for the key.
  const key = `vz_${crypto.randomBytes(32).toString("hex")}`;

  // create a secure hash of the key for database storage.
  const keyHash = hashKey(key);

  // prepare the data for insertion.
  const keyId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // store the key hash and metadata in the database.
  db.insert(apiKeys)
    .values({
      id: keyId,
      name,
      userId: userId,
      keyHash: keyHash,
      scopes: scopes.join(","),
      createdAt: createdAt,
      expiresAt: expiresAt?.toISOString() ?? null,
    })
    .run();

  return {
    id: keyId,
    name,
    key,
    createdAt,
  };
}
