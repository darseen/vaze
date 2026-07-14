"use server";

import { db } from "@/db";
import { apiKeys } from "@repo/db";
import auth from "@/utils/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createApiKey } from "./_utils";

export default async function generateApiKey(
  name: string,
  expiresAt: Date | null,
) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

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
    const key = createApiKey(user.id, name, expiresAt);

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: { key } };
  } catch (error) {
    console.log("generate api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
