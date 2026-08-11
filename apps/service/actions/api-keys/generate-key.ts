"use server";

import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
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

    recordActivity({
      userId: user.id,
      type: "api-key.created",
      target: name,
      detail: expiresAt
        ? `Expires ${expiresAt.toISOString().slice(0, 10)}`
        : "Never expires",
    });

    revalidatePath("/dashboard/api-keys");
    return { error: null, data: { key } };
  } catch (error) {
    console.log("generate api key error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
