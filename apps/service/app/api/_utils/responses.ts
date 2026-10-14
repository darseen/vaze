import { APIError } from "better-auth/api";
import { NextResponse } from "next/server";

export function fail(message: string, status: number) {
  return NextResponse.json({ data: null, error: { message } }, { status });
}

/** Keeps a Better Auth refusal's message and status; anything else is a 500. */
export function authApiFailure(error: unknown, fallback: string) {
  if (error instanceof APIError) {
    return fail(error.body?.message ?? fallback, error.statusCode);
  }

  console.error(`${fallback.toLowerCase()} error`, error);
  return fail("Internal server error", 500);
}
