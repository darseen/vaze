import { db } from "@/db";
import { folders as foldersTable } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  accessPath,
  isRootFolder,
  joinKey,
  revalidateDashboard,
  toStoragePath,
} from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";
import {
  keyTaken,
  renameOnDisk,
  resolveDestination,
  updateDescendantKeys,
  type MoveDestination,
} from "../../_utils/move";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:write",
    });
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const body: { id?: string } & MoveDestination = await request.json();

    if (typeof body.id !== "string" || body.id === "") {
      return NextResponse.json(
        { data: null, error: { message: "Missing id" } },
        { status: 400 },
      );
    }

    const folder = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.id, body.id))
      .get();

    if (!folder) {
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    if (isRootFolder(folder)) {
      return NextResponse.json(
        { data: null, error: { message: "The root folder cannot be moved" } },
        { status: 400 },
      );
    }

    const oldPath = toStoragePath(folder.key);
    if (!(await accessPath(oldPath))) {
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    const { folder: destination, error } = await resolveDestination(
      body,
      folder.key,
    );
    if (error) {
      return NextResponse.json(
        { data: null, error: { message: error.message } },
        { status: error.status },
      );
    }

    if (destination.id === folder.parentId) {
      return NextResponse.json({ data: { folder }, error: null });
    }

    const newKey = joinKey(destination.key, folder.name);

    if (await keyTaken(newKey)) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `"${folder.name}" already exists in the destination folder`,
          },
        },
        { status: 409 },
      );
    }

    let moved;
    try {
      moved = await renameOnDisk(oldPath, toStoragePath(newKey), () =>
        db.transaction((tx) => {
          const updated = tx
            .update(foldersTable)
            .set({
              parentId: destination.id,
              key: newKey,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(foldersTable.id, folder.id))
            .returning()
            .get();
          updateDescendantKeys(tx, folder.id, newKey);
          return updated;
        }),
      );
    } catch (error) {
      console.error("move folder error", error);
      return NextResponse.json(
        { data: null, error: { message: "Error moving folder" } },
        { status: 500 },
      );
    }

    revalidateDashboard();
    return NextResponse.json({ data: { folder: moved }, error: null });
  } catch (error) {
    console.error("move folder error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}
