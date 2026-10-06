"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export default async function revokeOtherSessions() {
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() });

    revalidatePath("/dashboard/settings");
    return { error: null, data: {} };
  } catch {
    return { error: { message: "Unauthorized" }, data: null };
  }
}
