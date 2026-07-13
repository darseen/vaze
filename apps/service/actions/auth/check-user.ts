"use server";

import db from "@/db";
import { User } from "@repo/types";

export default async function checkUser() {
  try {
    // Only ever expose whether an admin account exists — never the user row
    // (this action is intentionally public, used to gate register vs sign-in).
    const statement = db.prepare(`SELECT id FROM users LIMIT 1;`);
    const user = statement.get() as Pick<User, "id"> | undefined;

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
