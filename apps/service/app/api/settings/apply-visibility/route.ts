import { parseVisibility, revalidateDashboard } from "@/app/api/_utils";
import authorizeRequest from "@/app/api/_utils/authorize-request";
import { fail } from "@/app/api/_utils/responses";
import { db } from "@/db";
import { files } from "@repo/db";
import { ne, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/** Gives every existing file the visibility the admin confirmed. */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "settings:manage",
      session: true,
    });
    if (authError) return fail(authError.message, authError.status);

    const body: { visibility?: unknown } = await request.json();
    const visibility = parseVisibility(body.visibility);

    if (!visibility) return fail("Invalid visibility", 400);

    const { changes } = db
      .update(files)
      .set({ visibility, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(ne(files.visibility, visibility))
      .run();

    revalidateDashboard();
    return NextResponse.json({ data: { updated: changes }, error: null });
  } catch (error) {
    console.error("apply visibility error", error);
    return fail("Internal server error", 500);
  }
}
