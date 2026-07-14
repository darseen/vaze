import { db } from "@/db";
import { files as filesTable, folders as foldersTable } from "@repo/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { renameSync } from "node:fs";
import path from "node:path";
import { accessPathSync, isValidName } from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }
    const { id, name }: { id: string; name: string } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id or name" } },
        { status: 400 },
      );
    }

    // Folder names must be a single path segment with no dots (consistent with
    // folder creation) so a rename can never escape its parent directory.
    if (!isValidName(name, { allowDots: false })) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid folder name" } },
        { status: 400 },
      );
    }

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
    if (!accessPathSync(folder.path)) {
      // drop the orphaned row and report it as gone
      db.delete(foldersTable).where(eq(foldersTable.id, id)).run();
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    // no-op rename
    if (folder.name === name) {
      return NextResponse.json({ data: null, error: null });
    }

    const oldPath = folder.path;
    const newPath = path.join(path.dirname(oldPath), name);

    // check for name conflicts among siblings (parentId may be NULL for root)
    const conflictCheck = db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(
        and(
          folder.parentId === null
            ? isNull(foldersTable.parentId)
            : eq(foldersTable.parentId, folder.parentId),
          eq(foldersTable.name, name),
        ),
      )
      .get();

    if (conflictCheck) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `A folder named "${name}" already exists in this directory.`,
          },
        },
        { status: 409 },
      );
    }

    // Rename on disk first, then update the DB (folder + all descendant paths)
    // atomically. If the DB write fails, roll the disk rename back.
    let renamed = false;
    try {
      renameSync(oldPath, newPath);
      renamed = true;

      db.transaction((tx) => {
        tx.update(foldersTable)
          .set({ name, path: newPath, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(foldersTable.id, id))
          .run();
        updateDescendantPaths(tx, id, newPath);
      });
    } catch (error) {
      console.log("update folder error", error);
      if (renamed) {
        try {
          renameSync(newPath, oldPath);
        } catch {
          // best-effort rollback
        }
      }
      return NextResponse.json(
        { data: null, error: { message: "Error renaming folder" } },
        { status: 500 },
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.log("update folder error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

// the transaction handle passed to db.transaction's callback
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// a function to update all descendant paths recursively
function updateDescendantPaths(
  tx: Tx,
  parentId: string,
  newParentPath: string,
) {
  const subfolders = tx
    .select({ id: foldersTable.id, name: foldersTable.name })
    .from(foldersTable)
    .where(eq(foldersTable.parentId, parentId))
    .all();

  const files = tx
    .select({ id: filesTable.id, name: filesTable.name })
    .from(filesTable)
    .where(eq(filesTable.folderId, parentId))
    .all();

  if (subfolders.length === 0 && files.length === 0) return;

  for (const file of files) {
    const newFilePath = path.join(newParentPath, file.name);

    tx.update(filesTable)
      .set({ path: newFilePath })
      .where(eq(filesTable.id, file.id))
      .run();
  }

  for (const folder of subfolders) {
    const newFolderPath = path.join(newParentPath, folder.name);

    tx.update(foldersTable)
      .set({ path: newFolderPath })
      .where(eq(foldersTable.id, folder.id))
      .run();

    updateDescendantPaths(tx, folder.id, newFolderPath);
  }
}
