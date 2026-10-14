import authorizeRequest from "@/app/api/_utils/authorize-request";
import { fail } from "@/app/api/_utils/responses";
import { MAX_DELETE_BATCH } from "@/constants";
import { db } from "@/db";
import { listActivities } from "@/lib/activity";
import { activities } from "@repo/db";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { session: true },
    );
    if (authError) return fail(authError.message, authError.status);

    return NextResponse.json({
      data: { activities: listActivities(authData.user.id) },
      error: null,
    });
  } catch (error) {
    console.error("list activities error", error);
    return fail("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { session: true },
    );
    if (authError) return fail(authError.message, authError.status);

    const body: { ids?: unknown; all?: unknown } = await request.json();
    const owned = eq(activities.userId, authData.user.id);

    if (body.all === true) {
      const { changes } = db.delete(activities).where(owned).run();
      return NextResponse.json({ data: { deleted: changes }, error: null });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string")
      : null;

    if (!ids) return fail("Send ids, or all: true", 400);
    // a client-supplied list still becomes one `IN (...)` clause
    if (ids.length > MAX_DELETE_BATCH) {
      return fail(
        `Cannot delete more than ${MAX_DELETE_BATCH} entries at once`,
        400,
      );
    }
    if (ids.length === 0) {
      return NextResponse.json({ data: { deleted: 0 }, error: null });
    }

    const { changes } = db
      .delete(activities)
      .where(and(owned, inArray(activities.id, ids)))
      .run();

    return NextResponse.json({ data: { deleted: changes }, error: null });
  } catch (error) {
    console.error("delete activities error", error);
    return fail("Internal server error", 500);
  }
}
