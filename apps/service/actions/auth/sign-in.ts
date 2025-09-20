"use server";

import db from "@/db";
import { issueJWT } from "@/utils/jwt";
import { comparePassword } from "@/utils/password";
import { User } from "@repo/types";
import { cookies } from "next/headers";

export default async function signIn(formData: FormData) {
  const username = formData.get("username") as string | null;
  const password = formData.get("password") as string | null;

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

    // generate token
    const token = await issueJWT({ username: user.username, id: user.id });

    // set token cookie
    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return { data: { user }, error: null, status: 200 };
  } catch (error) {
    console.log(error);
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
