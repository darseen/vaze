import db from "@/db";
import auth from "@/utils/auth";
import { ApiKey } from "@repo/types";

export default async function fetchKeys() {
  try {
    const user = await auth();

    if (!user) return { data: null, error: { message: "Unauthorized" } };

    // fetch keys from database
    const statement = db.prepare(
      `SELECT id, name, created_at, last_used, expires_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    );
    const keys = statement.all(user.id) as Omit<
      ApiKey,
      "key_hash" | "user_id"
    >[];

    return { data: { keys }, error: null };
  } catch (error) {
    console.log("fetch keys error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
