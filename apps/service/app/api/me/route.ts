import authorizeRequest from "@/app/api/_utils/authorize-request";
import { authApiFailure, fail } from "@/app/api/_utils/responses";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { users } from "@repo/db";
import type { Me, Scope } from "@repo/types";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function readMe(userId: string, scopes: Scope[]): Me | null {
  const user = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return user ? { user, scopes } : null;
}

export async function GET(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      {},
    );
    if (authError) return fail(authError.message, authError.status);

    const data = readMe(authData.user.id, authData.scopes);
    if (!data) return fail("Unauthorized", 401);

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("get me error", error);
    return fail("Internal server error", 500);
  }
}

/** Changes the signed-in user's name or sign-in email. */
export async function PUT(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { session: true },
    );
    if (authError) return fail(authError.message, authError.status);

    const current = readMe(authData.user.id, authData.scopes);
    if (!current) return fail("Unauthorized", 401);

    const body: { name?: unknown; email?: unknown } = await request.json();

    if (body.name === undefined && body.email === undefined) {
      return fail("Send name or email", 400);
    }

    const name =
      body.name === undefined
        ? current.user.name
        : typeof body.name === "string"
          ? body.name.trim()
          : "";
    const email =
      body.email === undefined
        ? current.user.email
        : typeof body.email === "string"
          ? body.email.trim().toLowerCase()
          : "";

    if (!name || !email) return fail("Name and email can't be empty", 400);

    // Better Auth skips a taken address without saying so
    if (email !== current.user.email) {
      const taken = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .get();
      if (taken) return fail("Another account already uses that email", 409);
    }

    try {
      if (name !== current.user.name) {
        await auth.api.updateUser({ body: { name }, headers: request.headers });
      }

      if (email !== current.user.email) {
        await auth.api.changeEmail({
          body: { newEmail: email },
          headers: request.headers,
        });
      }
    } catch (error) {
      return authApiFailure(error, "Couldn't update profile");
    }

    return NextResponse.json({
      data: readMe(authData.user.id, authData.scopes),
      error: null,
    });
  } catch (error) {
    console.error("update me error", error);
    return fail("Internal server error", 500);
  }
}
