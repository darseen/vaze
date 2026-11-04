import { db } from "@/db";
import { recordActivity } from "@/lib/activity";
import { deleteFolder } from "@/lib/deleted";
import { folders as foldersTable } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isRootFolder, revalidateDashboard } from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function DELETE(request: NextRequest) {
  try {
    const { data: authData, error: authError } = await authorizeRequest(
      request,
      { scope: "files:delete" },
    );
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const { id, permanent }: { id: string; permanent?: unknown } =
      await request.json();

    const folder = db
      .select()
      .from(foldersTable)
      .where(and(eq(foldersTable.id, id), isNull(foldersTable.deletedAt)))
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

    try {
      await deleteFolder(folder, { permanent: permanent === true });
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
