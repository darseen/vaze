import authorizeRequest from "@/app/api/_utils/authorize-request";
import { db } from "@/db";
import { users } from "@repo/db";
import type { Me } from "@repo/types";
import { eq } from "drizzle-orm";
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

    const user = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, authData.user.id))
      .get();

    if (!user) {
      return NextResponse.json(
        { data: null, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const data: Me = { user, scopes: authData.scopes };

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("get me error", error);
    return NextResponse.json(
      { data: null, error: { message: "Internal server error" } },
      { status: 500 },
    );
  }
}
