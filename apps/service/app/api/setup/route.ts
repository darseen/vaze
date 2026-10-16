import { hasAccounts } from "@/lib/users";
import { NextResponse } from "next/server";

// public, so a client can offer to create the admin account on a new instance
export function GET() {
  try {
    return NextResponse.json({ data: { needed: !hasAccounts() }, error: null });
  } catch (error) {
    console.error("setup check error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
