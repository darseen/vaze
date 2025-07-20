"use server";

import db, { User } from "@/db";
import { comparePassword } from "@/utils";

export default async function validateUser(data: {
  username: string;
  password: string;
}) {
  const { username, password } = data;

  if (!username || !password) {
    return {
      data: null,
      error: { message: "Missing required fields" },
      status: 400,
    };
  }

  try {
    // check if user exists
    const statement = db.prepare(`SELECT * FROM users WHERE username = ?;`);
    const user = statement.get(username) as User;

    if (!user) {
      return { data: null, error: { message: "User not found" }, status: 404 };
    }

    // check if password is correct
    const passwordHash = user.password_hash;
    const isPasswordCorrect = await comparePassword(password, passwordHash);
    if (!isPasswordCorrect) {
      return {
        data: null,
        error: { message: "Invalid credentials" },
        status: 401,
      };
    }

    return { data: user, error: null, status: 200 };
  } catch (error) {
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
