"use server";

import db from "@/db";
import { apiKeys } from "@/db/schema";
import auth from "@/utils/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteApiKey(keyId: string) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    const result = db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.user_id, user.id)))
      .run();

    if (result.changes === 0) {
      return { error: { message: "Key not found" }, data: null };
    }

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: {} };
  } catch (error) {
    console.log("delete api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
