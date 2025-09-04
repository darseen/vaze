import db, { File } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import authorizeRequest from "../_utils/authorize-request";

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    // fetch all files from the database
    const files = db.prepare("SELECT * FROM files").all() as File[];

    return NextResponse.json({ data: { files }, error: null });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
