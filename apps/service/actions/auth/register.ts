"use server";

import db from "@/db";
import { users } from "@/db/schema";
import { issueJWT } from "@/utils/jwt";
import { hashPassword } from "@/utils/password";
import { count } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "node:crypto";

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
    // Hash before the transaction (scrypt is async; better-sqlite3 txns are sync).
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();

    try {
      // Single-admin model: atomically re-check that no user exists, then
      // insert — so two concurrent registrations can't both succeed.
      db.transaction((tx) => {
        const [{ value: userCount }] = tx
          .select({ value: count() })
          .from(users)
          .all();

        if (userCount > 0) {
          throw new Error("USER_EXISTS");
        }

        tx.insert(users)
          .values({ id: userId, username, password_hash: passwordHash })
          .run();
      });
    } catch (error) {
      if (error instanceof Error && error.message === "USER_EXISTS") {
        return {
          data: null,
          error: { message: "User already exists" },
          status: 409,
        };
      }
      throw error;
    }

    // generate token
    const token = await issueJWT({ username, id: userId });

    (await cookies()).set("token", token, {
      httpOnly: true,
      secure: process.env.BASE_URL?.startsWith("https://") ?? false,
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
