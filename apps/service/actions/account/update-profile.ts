"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export default async function updateProfile(input: {
  name: string;
  email: string;
}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) return { error: { message: "Unauthorized" }, data: null };

  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const email =
    typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";

  if (!name || !email) {
    return { error: { message: "Name and email are required" }, data: null };
  }

  try {
    if (name !== session.user.name) {
      await auth.api.updateUser({ body: { name }, headers: requestHeaders });
    }

    if (email !== session.user.email) {
      await auth.api.changeEmail({
        body: { newEmail: email },
        headers: requestHeaders,
      });
    }

    revalidatePath("/dashboard", "layout");
    return { error: null, data: { name, email } };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        error: { message: error.body?.message ?? "Couldn't update profile" },
        data: null,
      };
    }

    console.log("update profile error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
