import { db } from "@/db";
import { folders as foldersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { accessPath } from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function DELETE(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }

    const { id }: { id: string } = await request.json();

    // find in database
    const folder = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.id, id))
      .get();

    if (!folder) {
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    // check if folder exists on disk
    const folderExists = await accessPath(folder.path);
    if (!folderExists) {
      // delete folder from database if it doesn't exist on disk
      db.delete(foldersTable).where(eq(foldersTable.id, id)).run();
      revalidatePath("/dashboard");

      return NextResponse.json(
        { error: { message: "Folder not found" }, data: null },
        { status: 404 },
      );
    }

    // delete folder from disk and database
    try {
      await fs.rm(folder.path, { recursive: true });
      db.delete(foldersTable).where(eq(foldersTable.id, id)).run();
    } catch {
      return NextResponse.json(
        { error: { message: "Error deleting folder" }, data: null },
        { status: 500 },
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.log("delete folder error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
