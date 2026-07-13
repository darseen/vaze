"use server";

import db from "@/db";
import auth from "@/utils/auth";
import { revalidatePath } from "next/cache";

export async function updateApiKey(keyId: string, name: string) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    const stmt = db.prepare(
      "UPDATE api_keys SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    );
    const result = stmt.run(name, keyId, user.id);

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
