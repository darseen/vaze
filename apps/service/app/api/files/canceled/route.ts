import authorizeRequest from "@/app/api/_utils/authorize-request";
import { recordActivity, summarizeNames } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";

// uploads canceled while still queued never reach the upload route, so the client reports them
export async function POST(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { scope: "files:write" },
    );
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    let body: { names?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: "Invalid request body" } },
        { status: 400 },
      );
    }

    const names = (Array.isArray(body?.names) ? body.names : []).filter(
      (name): name is string => typeof name === "string" && name !== "",
    );
    if (names.length === 0) {
      return NextResponse.json(
        { data: null, error: { message: "No file names provided" } },
        { status: 400 },
      );
    }

    const { target, detail } = summarizeNames(names);
    recordActivity({
      userId: authData.user.id,
      type: "upload.canceled",
      target,
      detail: detail ?? "Canceled before it started",
    });

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("record canceled uploads error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
