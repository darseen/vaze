import { parseIds, revalidateDashboard } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { fail } from "@/app/api/_utils/responses";
import { MAX_DELETE_BATCH } from "@/constants";
import { listDeleted, purgeItems } from "@/lib/deleted";
import { getLimits } from "@/lib/settings";
import { NextRequest, NextResponse } from "next/server";

/** What is in Recently deleted, most recently deleted first. */
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:read",
    });
    if (authError) return fail(authError.message, authError.status);

    return NextResponse.json({
      data: {
        items: listDeleted(),
        retentionDays: getLimits().deletedRetentionDays,
      },
      error: null,
    });
  } catch (error) {
    console.error("list deleted error", error);
    return fail("Internal server error", 500);
  }
}

/** Delete items for good before their time is up, or empty it with `all`. */
export async function DELETE(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:delete",
    });
    if (authError) return fail(authError.message, authError.status);

    const body: { ids?: unknown; all?: unknown } = await request.json();

    const ids =
      body.all === true
        ? listDeleted().map((item) => item.id)
        : parseIds(body.ids);

    if (!ids) return fail("Send ids, or all: true", 400);
    if (body.all !== true && ids.length > MAX_DELETE_BATCH) {
      return fail(
        `Cannot delete more than ${MAX_DELETE_BATCH} items at once`,
        400,
      );
    }

    const { done, failed } = await purgeItems(ids);
    if (done.length > 0) revalidateDashboard();

    return NextResponse.json({ data: { deleted: done, failed }, error: null });
  } catch (error) {
    console.error("purge deleted error", error);
    return fail("Internal server error", 500);
  }
}
