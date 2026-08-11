"use server";

import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { apiKeys } from "@repo/db";
import auth from "@/utils/auth";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateApiKey(keyId: string, name: string) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    // read the old name first so the history row can show what it was
    const previous = db
      .select({ name: apiKeys.name })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
      .get();

    if (!previous) {
      return { error: { message: "Key not found" }, data: null };
    }

    db.update(apiKeys)
      .set({ name, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
      .run();

    if (previous.name !== name) {
      recordActivity({
        userId: user.id,
        type: "api-key.renamed",
        target: name,
        detail: `Renamed from "${previous.name}"`,
      });
    }

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: {} };
  } catch (error) {
    console.log("update api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
