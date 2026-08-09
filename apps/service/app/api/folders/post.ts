import { db } from "@/db";
import { folders as foldersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  accessPath,
  createNestedFolders,
  isValidKey,
  normalizeKey,
  revalidateDashboard,
  toStoragePath,
} from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const { folder }: { folder: string } = await request.json();

    const key = normalizeKey(folder);

    if (!key) {
      return NextResponse.json(
        { data: null, error: { message: "Missing folder" } },
        { status: 400 },
      );
    }

    if (!isValidKey(key)) {
      return NextResponse.json(
        { error: { message: "Invalid folder path" }, data: null },
        { status: 400 },
      );
    }

    const existsInDb = db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(eq(foldersTable.key, key))
      .get();

    if (existsInDb || (await accessPath(toStoragePath(key)))) {
      return NextResponse.json(
        { data: null, error: { message: "Folder already exists" } },
        { status: 409 },
      );
    }

    const newFolder = await createNestedFolders(key);

    revalidateDashboard();
    return NextResponse.json({ data: { folder: newFolder }, error: null });
  } catch (error) {
    console.error("create folder error ", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
