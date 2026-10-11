"use server";

import { recordActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { authorize } from "@/utils/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { actionError, findUser } from "./_utils";

export default async function resetPassword(userId: string, password: string) {
  const { user, error } = await authorize("users:manage");

  if (error) return { error, data: null };

  if (userId === user.id) {
    return {
      error: { message: "Change your own password in Settings" },
      data: null,
    };
  }

  if (typeof password !== "string" || !password) {
    return { error: { message: "Enter a new password" }, data: null };
  }

  const target = findUser(userId);

  if (!target) return { error: { message: "User not found" }, data: null };

  try {
    const requestHeaders = await headers();

    await auth.api.setUserPassword({
      body: { userId, newPassword: password },
      headers: requestHeaders,
    });
    // whoever knew the old password is signed out with it
    await auth.api.revokeUserSessions({
      body: { userId },
      headers: requestHeaders,
    });

    recordActivity({
      userId: user.id,
      type: "user.password-reset",
      target: target.name,
      detail: "Signed out of every device",
    });

    revalidatePath("/dashboard/users");
    return { error: null, data: {} };
  } catch (error) {
    return actionError(error, "Couldn't reset password");
  }
}
