import db from "@/db";
import { apiKeys } from "@/db/schema";
import auth from "@/utils/auth";
import { desc, eq } from "drizzle-orm";

export default async function fetchKeys() {
  try {
    const user = await auth();

    if (!user) return { data: null, error: { message: "Unauthorized" } };

    // fetch keys from database
    const keys = db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        created_at: apiKeys.created_at,
        last_used: apiKeys.last_used,
        expires_at: apiKeys.expires_at,
      })
      .from(apiKeys)
      .where(eq(apiKeys.user_id, user.id))
      .orderBy(desc(apiKeys.created_at))
      .all();

    return { data: { keys }, error: null };
  } catch (error) {
    console.log("fetch keys error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
