import { db } from "@/db";
import { apiKeys } from "@repo/db";
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
        createdAt: apiKeys.createdAt,
        lastUsed: apiKeys.lastUsed,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt))
      .all();

    return { data: { keys }, error: null };
  } catch (error) {
    console.log("fetch keys error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
