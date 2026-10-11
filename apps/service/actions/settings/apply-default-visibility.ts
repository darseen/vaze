"use server";

import { parseVisibility } from "@/app/api/_utils";
import { db } from "@/db";
import { files } from "@repo/db";
import { authorize } from "@/utils/auth";
import { ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Give every existing file the visibility the admin confirmed. */
export default async function applyDefaultVisibility(value: string) {
  const { error } = await authorize("settings:manage");

  if (error) return { error, data: null };

  const visibility = parseVisibility(value);

  if (!visibility) {
    return { error: { message: "Invalid visibility" }, data: null };
  }

  try {
    const { changes } = db
      .update(files)
      .set({ visibility, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(ne(files.visibility, visibility))
      .run();

    revalidatePath("/dashboard", "layout");
    return { error: null, data: { updated: changes } };
  } catch (error) {
    console.log("apply default visibility error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
