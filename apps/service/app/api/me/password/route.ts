import authorizeRequest from "@/app/api/_utils/authorize-request";
import { authApiFailure, fail } from "@/app/api/_utils/responses";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      session: true,
    });
    if (authError) return fail(authError.message, authError.status);

    const body: {
      currentPassword?: unknown;
      newPassword?: unknown;
      revokeOtherSessions?: unknown;
    } = await request.json();
    const { currentPassword, newPassword } = body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return fail("Missing currentPassword or newPassword", 400);
    }

    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword },
        headers: request.headers,
      });

      // not changePassword's flag: it also replaces this session mid-request
      if (body.revokeOtherSessions === true) {
        await auth.api.revokeOtherSessions({ headers: request.headers });
      }
    } catch (error) {
      return authApiFailure(error, "Couldn't change password");
    }

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("change password error", error);
    return fail("Internal server error", 500);
  }
}
