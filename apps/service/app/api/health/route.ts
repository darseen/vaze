import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  return NextResponse.json(
    { data: { message: "Vaze is running!" }, error: null },
    { status: 200 },
  );
}
