import authorizeRequest from "@/app/api/_utils/authorize-request";
import { authApiFailure, fail } from "@/app/api/_utils/responses";
import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { hasScope, isDisabled } from "@/lib/permissions";
import {
  describeAccess,
  findUser,
  getUserSummary,
  listUsers,
  parseAccess,
} from "@/lib/users";
import { users } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// API keys never carry this scope, so only a signed-in admin gets through
async function authorize(request: NextRequest) {
  return await authorizeRequest(request, {
    scope: "users:manage",
    session: true,
  });
}

// the admin endpoints skip the length check sign-up applies
async function checkPassword(password: unknown): Promise<string | null> {
  if (typeof password !== "string" || !password) return "Enter a password";

  const { minPasswordLength, maxPasswordLength } = (await auth.$context)
    .password.config;

  if (
    password.length < minPasswordLength ||
    password.length > maxPasswordLength
  ) {
    return `Password must be ${minPasswordLength} to ${maxPasswordLength} characters`;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    return NextResponse.json({ data: { users: listUsers() }, error: null });
  } catch (error) {
    console.error("list users error", error);
    return fail("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: {
      name?: unknown;
      email?: unknown;
      password?: unknown;
      role?: unknown;
      scopes?: unknown;
    } = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!name || !email) return fail("Name and email are required", 400);

    const passwordError = await checkPassword(body.password);
    if (passwordError) return fail(passwordError, 400);

    const access = parseAccess(body);
    if (access.error !== null) return fail(access.error, 400);

    try {
      const { user: created } = await auth.api.createUser({
        body: {
          name,
          email,
          password: body.password as string,
          role: access.role,
          data: { scopes: access.scopes },
        },
        headers: request.headers,
      });

      recordActivity({
        userId: authData.user.id,
        type: "user.created",
        target: name,
        detail: `${email} · ${describeAccess(access.role, access.scopes)}`,
      });

      return NextResponse.json({
        data: { user: getUserSummary(created.id) },
        error: null,
      });
    } catch (error) {
      return authApiFailure(error, "Couldn't add user");
    }
  } catch (error) {
    console.error("create user error", error);
    return fail("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: {
      id?: unknown;
      role?: unknown;
      scopes?: unknown;
      password?: unknown;
      disabled?: unknown;
    } = await request.json();

    if (typeof body.id !== "string") return fail("Missing id", 400);
    const userId = body.id;

    const changesAccess = body.role !== undefined;
    const changesPassword = body.password !== undefined;
    const changesDisabled = body.disabled !== undefined;

    if (!changesAccess && !changesPassword && !changesDisabled) {
      return fail("Send role, password or disabled", 400);
    }

    // keeps the last admin from locking everyone out
    if (userId === authData.user.id) {
      return fail(
        changesAccess
          ? "You can't change your own role"
          : changesDisabled
            ? "You can't disable yourself"
            : "Change your own password in Settings",
        400,
      );
    }

    const access = changesAccess ? parseAccess(body) : null;
    if (access && access.error !== null) return fail(access.error, 400);

    if (changesPassword) {
      const passwordError = await checkPassword(body.password);
      if (passwordError) return fail(passwordError, 400);
    }

    if (changesDisabled && typeof body.disabled !== "boolean") {
      return fail("disabled must be true or false", 400);
    }

    const target = findUser(userId);
    if (!target) return fail("User not found", 404);

    if (access) {
      const outcome = db.transaction((tx) => {
        // re-read here so two admins can't demote each other at the same moment
        const actor = tx
          .select()
          .from(users)
          .where(eq(users.id, authData.user.id))
          .get();

        if (!actor || isDisabled(actor) || !hasScope(actor, "users:manage")) {
          return false;
        }

        tx.update(users)
          .set({
            role: access.role,
            scopes: access.scopes,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .run();
        return true;
      });

      if (!outcome) return fail("You don't have permission to do that", 403);

      const before = describeAccess(target.role, target.scopes);
      const after = describeAccess(access.role, access.scopes);

      if (before !== after) {
        recordActivity({
          userId: authData.user.id,
          type: "user.access-changed",
          target: target.name,
          detail: `${before} → ${after}`,
        });
      }
    }

    if (changesPassword) {
      try {
        await auth.api.setUserPassword({
          body: { userId, newPassword: body.password as string },
          headers: request.headers,
        });
        // whoever knew the old password is signed out with it
        await auth.api.revokeUserSessions({
          body: { userId },
          headers: request.headers,
        });
      } catch (error) {
        return authApiFailure(error, "Couldn't reset password");
      }

      recordActivity({
        userId: authData.user.id,
        type: "user.password-reset",
        target: target.name,
        detail: "Signed out of every device",
      });
    }

    if (changesDisabled) {
      const disabled = body.disabled === true;

      try {
        if (disabled) {
          await auth.api.banUser({
            body: { userId, banReason: "Disabled by an admin" },
            headers: request.headers,
          });
        } else {
          await auth.api.unbanUser({
            body: { userId },
            headers: request.headers,
          });
        }
      } catch (error) {
        return authApiFailure(
          error,
          disabled ? "Couldn't disable user" : "Couldn't enable user",
        );
      }

      recordActivity({
        userId: authData.user.id,
        type: disabled ? "user.disabled" : "user.enabled",
        target: target.name,
        detail: disabled ? "Signed out and API keys paused" : target.email,
      });
    }

    return NextResponse.json({
      data: { user: getUserSummary(userId) },
      error: null,
    });
  } catch (error) {
    console.error("update user error", error);
    return fail("Internal server error", 500);
  }
}

/** Removes the account with its sessions, API keys and history; files stay. */
export async function DELETE(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorize(request);
    if (authError) return fail(authError.message, authError.status);

    const body: { id?: unknown } = await request.json();
    if (typeof body.id !== "string") return fail("Missing id", 400);

    if (body.id === authData.user.id) {
      return fail("You can't delete yourself", 400);
    }

    const target = findUser(body.id);
    if (!target) return fail("User not found", 404);

    try {
      await auth.api.removeUser({
        body: { userId: body.id },
        headers: request.headers,
      });
    } catch (error) {
      return authApiFailure(error, "Couldn't delete user");
    }

    recordActivity({
      userId: authData.user.id,
      type: "user.deleted",
      target: target.name,
      detail: target.email,
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("delete user error", error);
    return fail("Internal server error", 500);
  }
}
