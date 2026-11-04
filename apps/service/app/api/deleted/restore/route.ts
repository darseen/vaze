import { parseIds, revalidateDashboard } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { fail } from "@/app/api/_utils/responses";
import { MAX_DELETE_BATCH } from "@/constants";
import { restoreItems } from "@/lib/deleted";
import { NextRequest, NextResponse } from "next/server";

/** Put items back where they were; each id reports its own outcome. */
export async function POST(request: NextRequest) {
  try {
    // undoing a delete is part of deleting, so it takes the same scope
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:delete",
    });
    if (authError) return fail(authError.message, authError.status);

    const body: { ids?: unknown } = await request.json();
    const ids = parseIds(body.ids);

    if (!ids || ids.length === 0) return fail("No ids provided", 400);
    if (ids.length > MAX_DELETE_BATCH) {
      return fail(
        `Cannot restore more than ${MAX_DELETE_BATCH} items at once`,
        400,
      );
    }

    const { done, failed } = await restoreItems(ids);
    if (done.length > 0) revalidateDashboard();

    return NextResponse.json({ data: { restored: done, failed }, error: null });
  } catch (error) {
    console.error("restore deleted error", error);
    return fail("Internal server error", 500);
  }
}
