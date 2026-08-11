"use server";

import { MAX_DELETE_BATCH } from "@/constants";
import { db } from "@/db";
import { activities } from "@repo/db";
import auth from "@/utils/auth";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function deleteActivities(ids: string[]) {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };
  if (ids.length === 0) return { error: null, data: { deleted: 0 } };

  // a client-supplied list still becomes one `IN (...)` clause
  if (ids.length > MAX_DELETE_BATCH) {
    return { error: { message: "Too many entries selected" }, data: null };
  }

  try {
    const result = db
      .delete(activities)
      .where(and(eq(activities.userId, user.id), inArray(activities.id, ids)))
      .run();

    revalidatePath("/dashboard/activity");
    return { error: null, data: { deleted: result.changes } };
  } catch (error) {
    console.log("delete activities error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}

export async function clearActivities() {
  const user = await auth();

  if (!user) return { error: { message: "Unauthorized" }, data: null };

  try {
    const result = db
      .delete(activities)
      .where(eq(activities.userId, user.id))
      .run();

    revalidatePath("/dashboard/activity");
    return { error: null, data: { deleted: result.changes } };
  } catch (error) {
    console.log("clear activities error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
