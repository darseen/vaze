"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";

export default async function signIn(formData: FormData) {
  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return {
      data: null,
      error: { message: "Missing required fields" },
      status: 400,
    };
  }

  try {
    // nextCookies sets the cookie; headers record the device and IP for Sessions
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    return { data: {}, error: null, status: 200 };
  } catch (error) {
    if (error instanceof APIError) {
      // Don't leak whether the email or the password was wrong.
      return {
        data: null,
        error: { message: "Invalid credentials" },
        status: 401,
      };
    }

    console.log("sign in error", error);
    return {
      data: null,
      error: { message: "Internal server error" },
      status: 500,
    };
  }
}
