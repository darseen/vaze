import authorizeRequest from "@/app/api/_utils/authorize-request";
import { getStats } from "@/lib/stats";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      {},
    );
    if (authError) {
      return NextResponse.json(
        { data: null, error: { message: authError.message } },
        { status: authError.status },
      );
    }

    const { user, scopes, sessionId } = authData;

    const data = await getStats({
      userId: user.id,
      scopes,
      session: sessionId !== null,
    });

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("get stats error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
