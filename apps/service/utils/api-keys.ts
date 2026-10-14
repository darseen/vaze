import { db } from "@/db";
import { parseKeyScopes } from "@/lib/permissions";
import { apiKeys } from "@repo/db";
import type { ApiKey, ApiKeySummary, CreatedApiKey, Scope } from "@repo/types";
import { desc, eq } from "drizzle-orm";
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

/** A user's keys, newest first. */
export function listApiKeys(userId: string): ApiKeySummary[] {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      lastUsed: apiKeys.lastUsed,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt))
    .all()
    .map((key) => ({ ...key, scopes: parseKeyScopes(key.scopes) }));
}

export function createApiKey(
  userId: string,
  name: string,
  expiresAt: Date | null,
  scopes: Scope[],
): CreatedApiKey {
  const key = `vz_${crypto.randomBytes(32).toString("hex")}`;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expires = expiresAt?.toISOString() ?? null;

  // only the hash is stored, so the secret can't be shown again
  db.insert(apiKeys)
    .values({
      id,
      name,
      userId,
      keyHash: hashKey(key),
      scopes: scopes.join(","),
      createdAt,
      expiresAt: expires,
    })
    .run();

  return {
    id,
    name,
    scopes,
    createdAt,
    lastUsed: null,
    expiresAt: expires,
    key,
  };
}
