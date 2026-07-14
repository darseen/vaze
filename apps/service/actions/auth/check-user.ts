"use server";

import { db } from "@/db";
import { users } from "@repo/db";

export default async function checkUser() {
  try {
    // Only ever expose whether an admin account exists — never the user row
    // (this action is intentionally public, used to gate register vs sign-in).
    const user = db.select({ id: users.id }).from(users).limit(1).get();

    if (!user) {
      return {
        data: null,
        error: { message: "User not found" },
        status: 404,
      };
    }

    return { data: { exists: true }, error: null, status: 200 };
  } catch {
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
