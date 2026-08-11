import { ACTIVITY_PAGE_LIMIT } from "@/constants";
import { db } from "@/db";
import { activities } from "@repo/db";
import auth from "@/utils/auth";
import { desc, eq } from "drizzle-orm";

export default async function fetchActivities() {
  try {
    const user = await auth();

    if (!user) return { data: null, error: { message: "Unauthorized" } };

    const rows = db
      .select({
        id: activities.id,
        type: activities.type,
        target: activities.target,
        detail: activities.detail,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .where(eq(activities.userId, user.id))
      .orderBy(desc(activities.createdAt))
      .limit(ACTIVITY_PAGE_LIMIT)
      .all();

    return { data: { activities: rows }, error: null };
  } catch (error) {
    console.log("fetch activities error", error);
    return { data: null, error: { message: "Something went wrong" } };
  }
}
