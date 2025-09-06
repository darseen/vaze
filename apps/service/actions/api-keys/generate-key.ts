"use server";

import db from "@/db";
import auth from "@/utils/auth";
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
    const stmt = db.prepare(
      "SELECT id FROM api_keys WHERE name = ? AND user_id = ?",
    );
    const result = stmt.get(name, user.id);

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
