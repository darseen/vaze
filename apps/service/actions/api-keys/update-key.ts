"use server";

import { db } from "@/db";
import { apiKeys } from "@repo/db";
import auth from "@/utils/auth";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateApiKey(keyId: string, name: string) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    const result = db
      .update(apiKeys)
      .set({ name, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
      .run();

    if (result.changes === 0) {
      return { error: { message: "Key not found" }, data: null };
    }

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: {} };
  } catch (error) {
    console.log("update api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
