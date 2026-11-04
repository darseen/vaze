import {
  createNestedFolders,
  parentKeyOf,
  toStoragePath,
} from "@/app/api/_utils";
import { keyTaken, type Tx } from "@/app/api/_utils/move";
import { BASE_DELETED_PATH } from "@/constants";
import { db } from "@/db";
import { getLimits } from "@/lib/settings";
import { removeThumbnails } from "@/lib/thumbnails";
import { files, folders, type File, type Folder } from "@repo/db";
import type { DeletedItem } from "@repo/types";
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import fs from "node:fs/promises";
import path from "node:path";

// Each Recently deleted item (a root) is one .deleted/<id> entry whose parent folder is not deleted.

type Queryable = typeof db | Tx;

export type Outcome =
  { error: null } | { error: { message: string; status: number } };

const OK: Outcome = { error: null };

function fail(message: string, status: number): Outcome {
  return { error: { message, status } };
}

// SQLite caps bound parameters per statement
const ID_CHUNK_SIZE = 500;

function chunks(ids: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    out.push(ids.slice(i, i + ID_CHUNK_SIZE));
  }
  return out;
}

// the format of CURRENT_TIMESTAMP, so it compares with datetime('now', ...)
function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function deletedPath(id: string): string {
  return path.join(BASE_DELETED_PATH, id);
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

/** The rows were purged or restored by another request in the meantime. */
class RowGone extends Error {}

/** A folder and the folders below it, walked by parentId so names never matter. */
function subtreeFolderIds(
  tx: Queryable,
  folderId: string,
  { activeOnly }: { activeOnly: boolean },
): string[] {
  const rows = tx.all<{ id: string }>(sql`
    WITH RECURSIVE tree(id) AS (
      SELECT ${folderId}
      UNION ALL
      SELECT folders.id FROM folders JOIN tree ON folders.parent_id = tree.id
      ${activeOnly ? sql`WHERE folders.deleted_at IS NULL` : sql``}
    )
    SELECT id FROM tree
  `);
  return rows.map((row) => row.id);
}

function fileIdsIn(tx: Queryable, folderIds: string[]): string[] {
  return chunks(folderIds).flatMap((chunk) =>
    tx
      .select({ id: files.id })
      .from(files)
      .where(inArray(files.folderId, chunk))
      .all()
      .map((row) => row.id),
  );
}

function rootFolderId(tx: Queryable): string {
  const root = tx
    .select({ id: folders.id })
    .from(folders)
    .where(isNull(folders.parentId))
    .get();
  if (!root) throw new Error("The root folder is missing");
  return root.id;
}

/** Earlier deletions inside these folders move under the root folder, so a purge of them can't cascade. */
function detachDeletedRoots(tx: Tx, folderIds: string[]) {
  const rootId = rootFolderId(tx);

  for (const chunk of chunks(folderIds)) {
    tx.update(files)
      .set({ folderId: rootId })
      .where(and(inArray(files.folderId, chunk), isNotNull(files.deletedAt)))
      .run();
    tx.update(folders)
      .set({ parentId: rootId })
      .where(
        and(inArray(folders.parentId, chunk), isNotNull(folders.deletedAt)),
      )
      .run();
  }
}

type Root = { type: "file"; row: File } | { type: "folder"; row: Folder };

const parent = alias(folders, "parent");

/** A file or folder in Recently deleted; anything deleted along with a folder isn't one. */
function findRoot(tx: Queryable, id: string): Root | null {
  const file = tx
    .select({ row: files })
    .from(files)
    .innerJoin(parent, eq(parent.id, files.folderId))
    .where(
      and(
        eq(files.id, id),
        isNotNull(files.deletedAt),
        isNull(parent.deletedAt),
      ),
    )
    .get();
  if (file) return { type: "file", row: file.row };

  const folder = tx
    .select({ row: folders })
    .from(folders)
    .innerJoin(parent, eq(parent.id, folders.parentId))
    .where(
      and(
        eq(folders.id, id),
        isNotNull(folders.deletedAt),
        isNull(parent.deletedAt),
      ),
    )
    .get();
  if (folder) return { type: "folder", row: folder.row };

  return null;
}

/** Remove a file for good, or move it to Recently deleted. Throws on failure. */
export async function deleteFile(
  file: File,
  { permanent = false }: { permanent?: boolean } = {},
) {
  const source = toStoragePath(file.key);

  if (!permanent) {
    try {
      await fs.rename(source, deletedPath(file.id));
    } catch (error) {
      if (!isMissing(error)) throw error;
      // gone from disk, so there is nothing to keep and the row goes as before
      permanent = true;
    }
  }

  if (permanent) {
    // `force` makes an already-missing file a no-op, so an orphaned row still goes
    await fs.rm(source, { force: true });
    db.delete(files)
      .where(and(eq(files.id, file.id), isNull(files.deletedAt)))
      .run();
    await removeThumbnails([file.id]);
    return;
  }

  try {
    const { changes } = db
      .update(files)
      .set({ deletedAt: timestamp() })
      .where(and(eq(files.id, file.id), isNull(files.deletedAt)))
      .run();
    if (changes === 0) throw new RowGone();
  } catch (error) {
    if (error instanceof RowGone) {
      // deleted for good by another request while this one moved it
      await fs.rm(deletedPath(file.id), { force: true });
      return;
    }
    await fs.rename(deletedPath(file.id), source).catch(() => {});
    throw error;
  }
}

/** Remove a folder and everything in it for good, or move it to Recently deleted. Throws on failure. */
export async function deleteFolder(
  folder: Folder,
  { permanent = false }: { permanent?: boolean } = {},
) {
  const source = toStoragePath(folder.key);

  if (!permanent) {
    try {
      await fs.rename(source, deletedPath(folder.id));
    } catch (error) {
      if (!isMissing(error)) throw error;
      permanent = true;
    }
  }

  if (permanent) {
    await fs.rm(source, { recursive: true, force: true });
    const fileIds = db.transaction((tx) => {
      // another request moved it to Recently deleted, which is its to keep
      const current = tx
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, folder.id), isNull(folders.deletedAt)))
        .get();
      if (!current) return [];

      const ids = subtreeFolderIds(tx, folder.id, { activeOnly: true });
      detachDeletedRoots(tx, ids);
      // read after detaching, so only the files that cascade are listed
      const cascaded = fileIdsIn(tx, ids);
      tx.delete(folders).where(eq(folders.id, folder.id)).run();
      return cascaded;
    });
    await removeThumbnails(fileIds);
    return;
  }

  try {
    db.transaction((tx) => {
      const current = tx
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, folder.id), isNull(folders.deletedAt)))
        .get();
      if (!current) throw new RowGone();

      const ids = subtreeFolderIds(tx, folder.id, { activeOnly: true });
      detachDeletedRoots(tx, ids);

      const deletedAt = timestamp();
      for (const chunk of chunks(ids)) {
        tx.update(files)
          .set({ deletedAt })
          .where(inArray(files.folderId, chunk))
          .run();
        tx.update(folders)
          .set({ deletedAt })
          .where(inArray(folders.id, chunk))
          .run();
      }
    });
  } catch (error) {
    if (error instanceof RowGone) {
      await fs.rm(deletedPath(folder.id), { recursive: true, force: true });
      return;
    }
    await fs.rename(deletedPath(folder.id), source).catch(() => {});
    throw error;
  }
}

/** Everything in Recently deleted, most recently deleted first. */
export function listDeleted(): DeletedItem[] {
  const purgeAfter = `+${getLimits().deletedRetentionDays} days`;

  const fileRoots = db
    .select({
      id: files.id,
      name: files.name,
      key: files.key,
      size: files.size,
      mimeType: files.mimeType,
      deletedAt: sql<string>`${files.deletedAt}`,
      purgeAt: sql<string>`datetime(${files.deletedAt}, ${purgeAfter})`,
    })
    .from(files)
    .innerJoin(parent, eq(parent.id, files.folderId))
    .where(and(isNotNull(files.deletedAt), isNull(parent.deletedAt)))
    .all();

  const folderRoots = db
    .select({
      id: folders.id,
      name: folders.name,
      key: folders.key,
      deletedAt: sql<string>`${folders.deletedAt}`,
      purgeAt: sql<string>`datetime(${folders.deletedAt}, ${purgeAfter})`,
    })
    .from(folders)
    .innerJoin(parent, eq(parent.id, folders.parentId))
    .where(and(isNotNull(folders.deletedAt), isNull(parent.deletedAt)))
    .all();

  // every folder below a deleted root was deleted with it
  const contents = db.all<{ root: string; files: number; size: number }>(sql`
    WITH RECURSIVE tree(root, id) AS (
      SELECT folders.id, folders.id FROM folders
      JOIN folders AS parent ON parent.id = folders.parent_id
      WHERE folders.deleted_at IS NOT NULL AND parent.deleted_at IS NULL
      UNION ALL
      SELECT tree.root, folders.id FROM folders JOIN tree ON folders.parent_id = tree.id
    )
    SELECT tree.root AS root, count(files.id) AS files, coalesce(sum(files.size), 0) AS size
    FROM tree LEFT JOIN files ON files.folder_id = tree.id
    GROUP BY tree.root
  `);
  const contentsByRoot = new Map(contents.map((row) => [row.root, row]));

  const items: DeletedItem[] = [
    ...fileRoots.map((file) => ({ ...file, type: "file" as const })),
    ...folderRoots.map((folder) => ({
      ...folder,
      type: "folder" as const,
      files: contentsByRoot.get(folder.id)?.files ?? 0,
      size: contentsByRoot.get(folder.id)?.size ?? 0,
    })),
  ];

  // CURRENT_TIMESTAMP strings sort chronologically
  return items.sort(
    (a, b) =>
      b.deletedAt.localeCompare(a.deletedAt) || a.name.localeCompare(b.name),
  );
}

/** Put an item back where it was, recreating any folders on the way that are gone. */
export async function restoreItem(id: string): Promise<Outcome> {
  const root = findRoot(db, id);
  if (!root) return fail("Not found in Recently deleted", 404);

  const { key, name } = root.row;
  const parentKey = parentKeyOf(key);

  if (await keyTaken(key)) {
    return fail(
      `"${name}" already exists in ${parentKey ? `"${parentKey}"` : "the root folder"}`,
      409,
    );
  }

  let destination: Folder;
  try {
    destination = await createNestedFolders(parentKey);
  } catch (error) {
    console.error("restore destination error", error);
    return fail(`Could not recreate the folder "${parentKey}"`, 500);
  }

  const from = deletedPath(id);
  const to = toStoragePath(key);

  try {
    await fs.rename(from, to);
  } catch (error) {
    if (isMissing(error)) {
      return findRoot(db, id)
        ? fail(`"${name}" is missing from the deleted area`, 404)
        : fail("Not found in Recently deleted", 404);
    }
    console.error("restore error", error);
    return fail(`Error restoring "${name}"`, 500);
  }

  try {
    db.transaction((tx) => {
      if (!findRoot(tx, id)) throw new RowGone();

      if (root.type === "file") {
        tx.update(files)
          .set({ folderId: destination.id, deletedAt: null })
          .where(eq(files.id, id))
          .run();
        return;
      }

      const ids = subtreeFolderIds(tx, id, { activeOnly: false });
      tx.update(folders)
        .set({ parentId: destination.id })
        .where(eq(folders.id, id))
        .run();
      for (const chunk of chunks(ids)) {
        tx.update(folders)
          .set({ deletedAt: null })
          .where(inArray(folders.id, chunk))
          .run();
        tx.update(files)
          .set({ deletedAt: null })
          .where(inArray(files.folderId, chunk))
          .run();
      }
    });
  } catch (error) {
    if (error instanceof RowGone) {
      // purged while the rename ran, so it goes after all
      await fs.rm(to, { recursive: true, force: true });
      return fail("Not found in Recently deleted", 404);
    }
    console.error("restore error", error);
    await fs.rename(to, from).catch(() => {});
    return fail(`Error restoring "${name}"`, 500);
  }

  return OK;
}

// the rows go first, so a restore that races the purge finds nothing to restore
async function purgeRoot(root: Root) {
  const { id } = root.row;

  const fileIds = db.transaction((tx) => {
    if (root.type === "file") {
      tx.delete(files).where(eq(files.id, id)).run();
      return [id];
    }
    const cascaded = fileIdsIn(
      tx,
      subtreeFolderIds(tx, id, { activeOnly: false }),
    );
    tx.delete(folders).where(eq(folders.id, id)).run();
    return cascaded;
  });

  // a failure here leaves an orphan that sweepOrphans retries later
  await fs
    .rm(deletedPath(id), { recursive: true, force: true })
    .catch((error) => console.error("failed to remove a purged item", error));
  await removeThumbnails(fileIds);
}

/** Delete an item in Recently deleted for good, before its time is up. */
export async function purgeItem(id: string): Promise<Outcome> {
  // found and purged without an await in between, so nothing can restore it first
  const root = findRoot(db, id);
  if (!root) return fail("Not found in Recently deleted", 404);

  try {
    await purgeRoot(root);
  } catch (error) {
    console.error("purge error", error);
    return fail(`Error deleting "${root.row.name}"`, 500);
  }

  return OK;
}

export type BatchOutcome = {
  done: string[];
  failed: { id: string; message: string }[];
};

/** Restore several items; folders go before what was inside them. */
export async function restoreItems(ids: string[]): Promise<BatchOutcome> {
  const depthOf = new Map(
    listDeleted().map((item) => [item.id, item.key.split("/").length]),
  );
  const ordered = [...ids].sort(
    (a, b) => (depthOf.get(a) ?? 0) - (depthOf.get(b) ?? 0),
  );

  const outcome: BatchOutcome = { done: [], failed: [] };
  for (const id of ordered) {
    const { error } = await restoreItem(id);
    if (error) outcome.failed.push({ id, message: error.message });
    else outcome.done.push(id);
  }
  return outcome;
}

export async function purgeItems(ids: string[]): Promise<BatchOutcome> {
  const outcome: BatchOutcome = { done: [], failed: [] };
  for (const id of ids) {
    const { error } = await purgeItem(id);
    if (error) outcome.failed.push({ id, message: error.message });
    else outcome.done.push(id);
  }
  return outcome;
}

// an entry this young may belong to a delete that hasn't saved its rows yet
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/** Removes .deleted entries no row points at, left by a purge cut short. */
async function sweepOrphans() {
  const entries = await fs.readdir(BASE_DELETED_PATH).catch(() => []);

  for (const name of entries) {
    const owned =
      db.select({ id: files.id }).from(files).where(eq(files.id, name)).get() ??
      db
        .select({ id: folders.id })
        .from(folders)
        .where(eq(folders.id, name))
        .get();
    if (owned) continue;

    const entryPath = path.join(BASE_DELETED_PATH, name);
    // a rename updates ctime, so this is how long it has been in .deleted
    const stats = await fs.lstat(entryPath).catch(() => null);
    if (!stats || Date.now() - stats.ctimeMs < ORPHAN_MIN_AGE_MS) continue;

    await fs
      .rm(entryPath, { recursive: true, force: true })
      .catch((error) => console.error("failed to remove an orphan", error));
  }
}

/** Purge what has been in Recently deleted longer than the retention. */
export async function purgeExpired() {
  const cutoff = sql`datetime('now', ${`-${getLimits().deletedRetentionDays} days`})`;

  const expired = [
    ...db
      .select({ id: files.id })
      .from(files)
      .innerJoin(parent, eq(parent.id, files.folderId))
      .where(and(lt(files.deletedAt, cutoff), isNull(parent.deletedAt)))
      .all(),
    ...db
      .select({ id: folders.id })
      .from(folders)
      .innerJoin(parent, eq(parent.id, folders.parentId))
      .where(and(lt(folders.deletedAt, cutoff), isNull(parent.deletedAt)))
      .all(),
  ];

  for (const { id } of expired) {
    // looked up again, since an earlier purge or a restore may have changed it
    const root = findRoot(db, id);
    if (root) await purgeRoot(root);
  }

  await sweepOrphans();
}
