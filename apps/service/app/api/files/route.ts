import db, { File } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import validateUser from "../_utils/validate-user";

export async function GET(request: NextRequest) {
  try {
    const formData = await request.formData();

    const username = formData.get("username") as string | null;
    const password = formData.get("password") as string | null;

    if (!username || !password) {
      return NextResponse.json(
        { error: { message: "Missing required fields" }, data: null },
        { status: 400 },
      );
    }

    const { error } = await validateUser({ username, password });

    if (error) {
      return NextResponse.json(
        { error: { message: error.message }, data: null },
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
