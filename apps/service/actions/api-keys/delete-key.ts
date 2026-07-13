"use server";

import db from "@/db";
import auth from "@/utils/auth";
import { revalidatePath } from "next/cache";

export async function deleteApiKey(keyId: string) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    const stmt = db.prepare(
      "DELETE FROM api_keys WHERE id = ? AND user_id = ?",
    );
    const result = stmt.run(keyId, user.id);

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
