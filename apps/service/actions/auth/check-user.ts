"use server";

import db from "@/db";
import { User } from "@repo/types";

export default async function checkUser() {
  try {
    const statement = db.prepare(`SELECT * FROM users;`);
    const users = statement.all() as User[];

    if (users.length === 0) {
      return { data: null, error: { message: "No user found" }, status: 404 };
    }

    return { data: users[0], error: null, status: 200 };
  } catch {
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
