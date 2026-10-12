"use server";

import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { normalizeKeyScopes, SCOPE_INFO, scopesOf } from "@/lib/permissions";
import { apiKeys } from "@repo/db";
import { authorize } from "@/utils/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createApiKey } from "./_utils";

export default async function generateApiKey(
  name: string,
  expiresAt: Date | null,
  scopes: string[],
) {
  const { user, error } = await authorize("api-keys:manage");

  if (error) return { error, data: null };

  const picked = normalizeKeyScopes(scopes);

  if (picked.length === 0) {
    return { error: { message: "Pick at least one scope" }, data: null };
  }

  const held = scopesOf(user);

  if (picked.some((scope) => !held.includes(scope))) {
    return {
      error: { message: "You can't give a key a scope you don't have" },
      data: null,
    };
  }

  try {
    // check if name is unique
    const result = db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.name, name), eq(apiKeys.userId, user.id)))
      .get();

    if (result) {
      return { error: { message: "Key name already exists" }, data: null };
    }

    // gererate key
    const key = createApiKey(user.id, name, expiresAt, picked);

    const access = picked.map((scope) => SCOPE_INFO[scope].label).join(", ");
    const expiry = expiresAt
      ? `Expires ${expiresAt.toISOString().slice(0, 10)}`
      : "Never expires";

    recordActivity({
      userId: user.id,
      type: "api-key.created",
      target: name,
      detail: `${access} · ${expiry}`,
    });

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: { key } };
  } catch (error) {
    console.log("generate api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
