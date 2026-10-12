import { db } from "@/db";
import { files as filesTable, folders as foldersTable } from "@repo/db";
import type { Folder } from "@repo/types";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import {
  accessPath,
  createNestedFolders,
  isValidKey,
  joinKey,
  normalizeKey,
  toStoragePath,
} from ".";

// the transaction handle passed to db.transaction's callback
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A move lands in an existing folder by id, or at a key created if missing. */
export interface MoveDestination {
  folderId?: unknown;
  folder?: unknown;
}

type Resolved =
  | { folder: Folder; error: null }
  | { folder: null; error: { message: string; status: number } };

function fail(message: string, status: number): Resolved {
  return { folder: null, error: { message, status } };
}

/** Find or create the folder a move lands in, never at or below `movingKey`. */
export async function resolveDestination(
  { folderId, folder }: MoveDestination,
  movingKey?: string,
): Promise<Resolved> {
  const inside = (key: string) =>
    movingKey !== undefined &&
    (key === movingKey || key.startsWith(`${movingKey}/`));

  if (typeof folderId === "string" && folderId !== "") {
    const row = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.id, folderId))
      .get();

    if (!row) return fail("Destination folder not found", 404);
    if (inside(row.key)) {
      return fail("A folder cannot be moved into itself", 400);
    }

    return { folder: row, error: null };
  }

  if (typeof folder !== "string") {
    return fail("Missing folderId or folder", 400);
  }

  const key = normalizeKey(folder);
  if (!isValidKey(key)) return fail("Invalid folder path", 400);
  // checked before creating anything, so a refused move leaves no folders behind
  if (inside(key)) return fail("A folder cannot be moved into itself", 400);

  try {
    return { folder: await createNestedFolders(key), error: null };
  } catch (error) {
    console.error("create destination folder error", error);
    return fail("Could not create the destination folder", 500);
  }
}

/** Files and folders share one namespace on disk, so all three must be free. */
export async function keyTaken(key: string): Promise<boolean> {
  const file = db
    .select({ id: filesTable.id })
    .from(filesTable)
    .where(eq(filesTable.key, key))
    .get();
  const folder = db
    .select({ id: foldersTable.id })
    .from(foldersTable)
    .where(eq(foldersTable.key, key))
    .get();

  return !!file || !!folder || (await accessPath(toStoragePath(key)));
}

/** Rename on disk, then run the DB write; a failed write puts the disk back. */
export async function renameOnDisk<T>(
  from: string,
  to: string,
  commit: () => T,
): Promise<T> {
  await fs.rename(from, to);
  try {
    return commit();
  } catch (error) {
    await fs.rename(to, from).catch(() => {});
    throw error;
  }
}

// Rewrite the keys of everything below a moved folder. Walking by parentId is
// exact, unlike a LIKE prefix match which breaks on names containing `%` or `_`.
export function updateDescendantKeys(
  tx: Tx,
  parentId: string,
  newParentKey: string,
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
