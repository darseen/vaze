import { findVideoJob, removeVideoJob, toVideoJob } from "@/lib/video/jobs";
import { NextRequest, NextResponse } from "next/server";
import authorizeRequest from "../../../_utils/authorize-request";
import { jsonError } from "../../../_utils/conversion";

type Params = { params: Promise<{ id: string }> };

const NOT_FOUND = "No such video conversion, or it has expired";

/** A video conversion's status and progress, for the caller who started it. */
export async function GET(request: NextRequest, { params }: Params) {
  const { data: auth, error: authError } = await authorizeRequest(request, {
    scope: "files:read",
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  const job = findVideoJob((await params).id, auth.user.id);
  if (!job) return jsonError(NOT_FOUND, 404);

  return NextResponse.json(
    { data: toVideoJob(job), error: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Stops a conversion that hasn't finished, or removes one that has, with its result. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { data: auth, error: authError } = await authorizeRequest(request, {
    scope: "files:read",
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  if (!removeVideoJob((await params).id, auth.user.id)) {
    return jsonError(NOT_FOUND, 404);
  }
  return NextResponse.json({ data: null, error: null });
}
