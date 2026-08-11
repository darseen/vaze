import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { folders as foldersTable } from "@repo/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { isRootFolder, revalidateDashboard, toStoragePath } from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function DELETE(request: NextRequest) {
  try {
    const { data: authData, error: authError } =
      await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const { id }: { id: string } = await request.json();

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

    // Deleting the root would recursively remove the entire uploads tree and
    // cascade every file row with it.
    if (isRootFolder(folder)) {
      return NextResponse.json(
        { data: null, error: { message: "The root folder cannot be deleted" } },
        { status: 400 },
      );
    }

    // a nested folder is worth showing by path, a top-level one names itself
    const path = folder.key === folder.name ? null : folder.key;

    // `force` makes an already-missing directory a no-op, so a row orphaned by
    // an out-of-band delete still gets cleaned up instead of 404ing forever.
    try {
      await fs.rm(toStoragePath(folder.key), { recursive: true, force: true });
      db.delete(foldersTable).where(eq(foldersTable.id, id)).run();
    } catch (error) {
      console.error("delete folder error", error);
      recordActivity({
        userId: authData.user.id,
        type: "folder.delete-failed",
        target: folder.name,
        detail: path,
      });
      return NextResponse.json(
        { error: { message: "Error deleting folder" }, data: null },
        { status: 500 },
      );
    }

    // everything under it went with it, which is exactly why this is worth a row
    recordActivity({
      userId: authData.user.id,
      type: "folder.deleted",
      target: folder.name,
      detail: path,
    });

    revalidateDashboard();
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("delete folder error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
