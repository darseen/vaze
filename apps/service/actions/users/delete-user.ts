"use server";

import { recordActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { authorize } from "@/utils/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { actionError, findUser } from "./_utils";

/** Removes the account with its sessions, API keys and history; files stay. */
export default async function deleteUser(userId: string) {
  const { user, error } = await authorize("users:manage");

  if (error) return { error, data: null };

  if (userId === user.id) {
    return { error: { message: "You can't delete yourself" }, data: null };
  }

  const target = findUser(userId);

  if (!target) return { error: { message: "User not found" }, data: null };

  try {
    await auth.api.removeUser({ body: { userId }, headers: await headers() });

    recordActivity({
      userId: user.id,
      type: "user.deleted",
      target: target.name,
      detail: target.email,
    });

    revalidatePath("/dashboard/users");
    return { error: null, data: {} };
  } catch (error) {
    return actionError(error, "Couldn't delete user");
  }
}
