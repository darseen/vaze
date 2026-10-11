"use server";

import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { hasScope, isDisabled } from "@/lib/permissions";
import { users } from "@repo/db";
import { authorize } from "@/utils/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { describeAccess, parseAccess, type AccessInput } from "./_utils";

export default async function updateAccess(userId: string, input: AccessInput) {
  const { user, error } = await authorize("users:manage");

  if (error) return { error, data: null };

  // keeps the last admin from locking everyone out
  if (userId === user.id) {
    return { error: { message: "You can't change your own role" }, data: null };
  }

  const access = parseAccess(input);

  if (access.error !== null) {
    return { error: { message: access.error }, data: null };
  }

  try {
    const outcome = db.transaction((tx) => {
      // re-read here so two admins can't demote each other at the same moment
      const actor = tx.select().from(users).where(eq(users.id, user.id)).get();

      if (!actor || isDisabled(actor) || !hasScope(actor, "users:manage")) {
        return { error: "You don't have permission to do that" } as const;
      }

      const target = tx
        .select({ name: users.name, role: users.role, scopes: users.scopes })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      if (!target) return { error: "User not found" } as const;

      tx.update(users)
        .set({
          role: access.role,
          scopes: access.scopes,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .run();

      return { error: null, target } as const;
    });

    if (outcome.error !== null) {
      return { error: { message: outcome.error }, data: null };
    }

    const before = describeAccess(outcome.target.role, outcome.target.scopes);
    const after = describeAccess(access.role, access.scopes);

    if (before !== after) {
      recordActivity({
        userId: user.id,
        type: "user.access-changed",
        target: outcome.target.name,
        detail: `${before} → ${after}`,
      });
    }

    revalidatePath("/dashboard/users");
    return { error: null, data: {} };
  } catch (error) {
    console.log("update access error", error);
    return { error: { message: "Something went wrong" }, data: null };
  }
}
