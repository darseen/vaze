"use server";

import { recordActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { authorize } from "@/utils/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { actionError, findUser } from "./_utils";

/** Disabling signs the user out everywhere and stops their API keys. */
export default async function setDisabled(userId: string, disabled: boolean) {
  const { user, error } = await authorize("users:manage");

  if (error) return { error, data: null };

  if (userId === user.id) {
    return { error: { message: "You can't disable yourself" }, data: null };
  }

  const target = findUser(userId);

  if (!target) return { error: { message: "User not found" }, data: null };

  try {
    const requestHeaders = await headers();

    if (disabled) {
      await auth.api.banUser({
        body: { userId, banReason: "Disabled by an admin" },
        headers: requestHeaders,
      });
    } else {
      await auth.api.unbanUser({ body: { userId }, headers: requestHeaders });
    }

    recordActivity({
      userId: user.id,
      type: disabled ? "user.disabled" : "user.enabled",
      target: target.name,
      detail: disabled ? "Signed out and API keys paused" : target.email,
    });

    revalidatePath("/dashboard/users");
    return { error: null, data: {} };
  } catch (error) {
    return actionError(
      error,
      disabled ? "Couldn't disable user" : "Couldn't enable user",
    );
  }
}
