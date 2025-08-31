"use server";

import crypto from "node:crypto";
import db, { User } from "@/db";
import { hashPassword, issueJWT } from "@/utils";
import { cookies } from "next/headers";

export default async function register(formData: FormData) {
  const username = formData.get("username") as string | null;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!username || !password || !confirmPassword) {
    return {
      data: null,
      error: { message: "Missing required fields" },
      status: 400,
    };
  }

  if (password !== confirmPassword) {
    return {
      data: null,
      error: { message: "Passwords do not match" },
      status: 400,
    };
  }

  try {
    // check if a user is already registered
    const statement = db.prepare(`SELECT * FROM users;`);
    const users = statement.all() as User[];

    if (users.length > 0) {
      return {
        data: null,
        error: { message: "User already exists" },
        status: 409,
      };
    }

    // check if username is already taken
    const statement1 = db.prepare(`SELECT * FROM users WHERE username = ?;`);
    const user = statement1.get(username) as User;

    if (user) {
      return {
        data: null,
        error: { message: "User already exists" },
        status: 409,
      };
    }

    const passwordHash = await hashPassword(password);

    const statement2 = db.prepare(
      `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?);`,
    );
    statement2.run(crypto.randomUUID(), username, passwordHash);

    // generate token
    const token = await issueJWT(username);

    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return { data: {}, error: null, status: 201 };
  } catch {
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
