import authorizeRequest from "@/app/api/_utils/authorize-request";
import { authApiFailure, fail } from "@/app/api/_utils/responses";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";
import { sessions } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { session: true },
    );
    if (authError) return fail(authError.message, authError.status);

    return NextResponse.json({
      data: { sessions: listSessions(authData.user.id, authData.sessionId) },
      error: null,
    });
  } catch (error) {
    console.error("list sessions error", error);
    return fail("Internal server error", 500);
  }
}

/** Signs out one of the caller's other devices, or all of them. */
export async function DELETE(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { session: true },
    );
    if (authError) return fail(authError.message, authError.status);

    const body: { id?: unknown; others?: unknown } = await request.json();

    if (body.others === true) {
      try {
        await auth.api.revokeOtherSessions({ headers: request.headers });
      } catch (error) {
        return authApiFailure(error, "Couldn't sign out other devices");
      }
      return NextResponse.json({ data: null, error: null });
    }

    if (typeof body.id !== "string") {
      return fail("Send id, or others: true", 400);
    }

    if (body.id === authData.sessionId) {
      return fail("Sign out to end this session", 400);
    }

    // the client only ever sees session ids, never their tokens
    const target = db
      .select({ token: sessions.token })
      .from(sessions)
      .where(
        and(eq(sessions.id, body.id), eq(sessions.userId, authData.user.id)),
      )
      .get();

    if (!target) return fail("Session not found", 404);

    try {
      await auth.api.revokeSession({
        body: { token: target.token },
        headers: request.headers,
      });
    } catch (error) {
      return authApiFailure(error, "Couldn't sign out the device");
    }

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("revoke session error", error);
    return fail("Internal server error", 500);
  }
}
