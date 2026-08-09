import { db } from "@/db";
import { files as filesTable, folders as foldersTable } from "@repo/db";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import {
  accessPath,
  isRootFolder,
  isValidName,
  joinKey,
  parentKeyOf,
  revalidateDashboard,
  toStoragePath,
} from "../_utils";
import authorizeRequest from "../_utils/authorize-request";

export default async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }
    const { id, name }: { id: string; name: string } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id or name" } },
        { status: 400 },
      );
    }

    // A folder name is a single path segment, so a rename can never move a
    // folder or escape its parent directory.
    if (!isValidName(name)) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid folder name" } },
        { status: 400 },
      );
    }

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

    // Renaming the root would move the uploads directory out from under the
    // instance and orphan every row beneath it.
    if (isRootFolder(folder)) {
      return NextResponse.json(
        { data: null, error: { message: "The root folder cannot be renamed" } },
        { status: 400 },
      );
    }

    const oldPath = toStoragePath(folder.key);

    if (!(await accessPath(oldPath))) {
      // drop the orphaned row and report it as gone
      db.delete(foldersTable).where(eq(foldersTable.id, id)).run();
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    if (folder.name === name) {
      return NextResponse.json({ data: null, error: null });
    }

    const newKey = joinKey(parentKeyOf(folder.key), name);
    const newPath = toStoragePath(newKey);

    const conflict = db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(eq(foldersTable.key, newKey))
      .get();

    if (conflict) {
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

    // Rename on disk first, then update the DB (folder + all descendant keys)
    // atomically. If the DB write fails, roll the disk rename back.
    let renamed = false;
    try {
      await fs.rename(oldPath, newPath);
      renamed = true;

      db.transaction((tx) => {
        tx.update(foldersTable)
          .set({ name, key: newKey, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(foldersTable.id, id))
          .run();
        updateDescendantKeys(tx, id, newKey);
      });
    } catch (error) {
      console.error("update folder error", error);
      if (renamed) {
        await fs.rename(newPath, oldPath).catch(() => {});
      }
      return NextResponse.json(
        { data: null, error: { message: "Error renaming folder" } },
        { status: 500 },
      );
    }

    revalidateDashboard();
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error("update folder error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

// the transaction handle passed to db.transaction's callback
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Rewrite the keys of everything below a moved folder. Walking by parentId is
// exact, unlike a LIKE prefix match which breaks on names containing `%` or `_`.
function updateDescendantKeys(tx: Tx, parentId: string, newParentKey: string) {
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

  for (const file of files) {
    tx.update(filesTable)
      .set({ key: joinKey(newParentKey, file.name) })
      .where(eq(filesTable.id, file.id))
      .run();
  }

  for (const folder of subfolders) {
    const childKey = joinKey(newParentKey, folder.name);

    tx.update(foldersTable)
      .set({ key: childKey })
      .where(eq(foldersTable.id, folder.id))
      .run();

    updateDescendantKeys(tx, folder.id, childKey);
  }
}
