"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";

export default async function register(formData: FormData) {
  const email = formData.get("email") as string | null;
  const username = formData.get("username") as string | null;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!email || !username || !password || !confirmPassword) {
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
    // `username` is stored as the display name. The single-admin invariant is
    // enforced by the `user.create.before` database hook in lib/auth.ts, so a
    // second registration is rejected here too. autoSignIn sets the session
    // cookie (via the nextCookies plugin) on success.
    await auth.api.signUpEmail({
      body: { email, password, name: username },
    });

    return { data: {}, error: null, status: 201 };
  } catch (error) {
    if (error instanceof APIError) {
      return {
        data: null,
        error: { message: error.body?.message ?? "Registration failed" },
        status: error.statusCode ?? 400,
      };
    }

    console.log("register error", error);
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
