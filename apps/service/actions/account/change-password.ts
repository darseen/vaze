"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export default async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  revokeOtherSessions: boolean;
}) {
  const { currentPassword, newPassword, confirmPassword } = input ?? {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: { message: "Missing required fields" }, data: null };
  }

  if (newPassword !== confirmPassword) {
    return { error: { message: "Passwords do not match" }, data: null };
  }

  try {
    const requestHeaders = await headers();

    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: requestHeaders,
    });

    // not changePassword's flag: it also replaces this session mid-request
    if (input.revokeOtherSessions === true) {
      await auth.api.revokeOtherSessions({ headers: requestHeaders });
    }

    revalidatePath("/dashboard/settings");
    return { error: null, data: {} };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error: { message: error.body?.message ?? "Couldn't change password" },
        data: null,
      };
    }

    console.log("change password error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
