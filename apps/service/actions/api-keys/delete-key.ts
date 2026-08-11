"use server";

import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { apiKeys } from "@repo/db";
import auth from "@/utils/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteApiKey(keyId: string) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    // returning the name so the history row can still say which key it was
    const deleted = db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
      .returning({ name: apiKeys.name })
      .all();

    if (deleted.length === 0) {
      return { error: { message: "Key not found" }, data: null };
    }

    recordActivity({
      userId: user.id,
      type: "api-key.deleted",
      target: deleted[0].name,
      detail: "Access revoked for anything using this key",
    });

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: {} };
  } catch (error) {
    console.log("delete api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
