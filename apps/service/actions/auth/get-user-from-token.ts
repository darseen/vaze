"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function getUserFromToken() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return { data: null, error: { message: "Unauthorized" }, status: 401 };
    }

    // The admin's display name is stored in Better Auth's `name` field; the UI
    // still refers to it as `username`.
    return {
      data: { username: session.user.name },
      error: null,
      status: 200,
    };
  } catch {
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
