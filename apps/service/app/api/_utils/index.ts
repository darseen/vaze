import { BASE_UPLOADS_PATH } from "@/constants";
import { db } from "@/db";
import { files as filesTable, folders as foldersTable } from "@repo/db";
import type { File, Folder, Visibility } from "@repo/types";
import { asc, desc, eq } from "drizzle-orm";
import { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { accessSync } from "node:fs";
import fs, { access, constants } from "node:fs/promises";
import path from "node:path";

export type OrderBy = "createdAt" | "updatedAt" | "name" | "size";
export type OrderDirection = "ASC" | "DESC";

export function revalidateDashboard() {
  try {
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("failed to revalidate the dashboard", error);
  }
}

/**
 * Turn a validated (orderBy, direction) pair into a Drizzle order clause for the
 * `files` table. Callers must pass already-whitelisted values.
 */
export function fileOrderBy(column: OrderBy, direction: OrderDirection) {
  const col = filesTable[column] as SQLiteColumn;
  return direction === "ASC" ? asc(col) : desc(col);
}

export async function accessPath(path: string) {
  return await access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

export function accessPathSync(path: string) {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a single file/folder name (not a path). Rejects path separators,
 * NUL bytes and `.`/`..` so a name can never escape its parent directory.
 */
export function isValidName(name: unknown): name is string {
  if (typeof name !== "string" || name.trim().length === 0) return false;
  if (/[/\\\0]/.test(name)) return false;
  if (name === "." || name === "..") return false;
  return true;
}

/** Narrow a caller-supplied value to a visibility, or null if it is neither. */
export function parseVisibility(value: unknown): Visibility | null {
  return value === "public" || value === "private" ? value : null;
}

/**
 * Normalize a caller-supplied folder path into a key: no leading/trailing
 * slashes, no empty segments. The root folder is the empty string.
 */
export function normalizeKey(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.split("/").filter(Boolean).join("/");
}

/**
 * Validate an already-normalized key. Every segment must be a valid name, which
 * rules out traversal (`..`), separators and NUL. The empty key (root) is valid.
 */
export function isValidKey(key: unknown): key is string {
  if (typeof key !== "string") return false;
  if (key === "") return true;
  return key.split("/").every((segment) => isValidName(segment));
}

export function joinKey(parentKey: string, name: string): string {
  return parentKey ? `${parentKey}/${name}` : name;
}

export function parentKeyOf(key: string): string {
  const index = key.lastIndexOf("/");
  return index === -1 ? "" : key.slice(0, index);
}

/**
 * Resolve a key to its absolute location on disk. Throws if the result would
 * land outside the uploads root — defense in depth behind `isValidKey`.
 */
export function toStoragePath(key: string): string {
  const root = path.resolve(BASE_UPLOADS_PATH);
  const target = path.resolve(root, key);

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Key "${key}" resolves outside the uploads root`);
  }

  return target;
}

/** The root folder is the only one without a parent. */
export function isRootFolder(folder: Pick<Folder, "parentId">): boolean {
  return folder.parentId === null;
}

/**
 * Parse an integer query param, falling back when it is missing or not a
 * finite number (so `?limit=abc` yields the default instead of a 500).
 */
export function parseIntParam(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Build an RFC 5987 compliant Content-Disposition header value. The ASCII
 * fallback strips characters that would make the header invalid, while the
 * `filename*` form carries the real (possibly non-ASCII) name.
 */
export function contentDisposition(
  type: "inline" | "attachment",
  filename: string,
): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;
}

/** Public hosting URL for a key, relative to the instance base URL. */
export function keyToUrl(key: string): string {
  return `api/hosting/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function getFilesWithUrls(files: File[]) {
  return files.map((file) => ({ ...file, url: keyToUrl(file.key) }));
}

/** Fetch the root folder, creating it (and its directory) if missing. */
export async function ensureRootFolder(): Promise<Folder> {
  const existing = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.key, ""))
    .get();

  if (existing) return existing;

  await fs.mkdir(BASE_UPLOADS_PATH, { recursive: true });

  db.insert(foldersTable)
    .values({
      id: crypto.randomUUID(),
      name: path.basename(BASE_UPLOADS_PATH),
      key: "",
      parentId: null,
    })
    .onConflictDoNothing()
    .run();

  const root = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.key, ""))
    .get();

  if (!root) throw new Error("Failed to create the root folder");

  return root;
}

/**
 * Walk a folder key, creating any missing directories and rows along the way,
 * and return the folder the key points at.
 */
export async function createNestedFolders(folderKey: string): Promise<Folder> {
  const key = normalizeKey(folderKey);

  if (!isValidKey(key)) {
    throw new Error("Invalid folder path");
  }

  const root = await ensureRootFolder();
  if (!key) return root;

  let currentKey = "";
  let parent = root;

  for (const segment of key.split("/")) {
    currentKey = joinKey(currentKey, segment);

    const existing = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.key, currentKey))
      .get();

    if (existing) {
      parent = existing;
      continue;
    }

    await fs.mkdir(toStoragePath(currentKey), { recursive: true });

    const created = db
      .insert(foldersTable)
      .values({
        id: crypto.randomUUID(),
        name: segment,
        key: currentKey,
        parentId: parent.id,
      })
      .returning()
      .get();

    parent = created;
  }

  return parent;
}

/** Files and direct subfolders of a folder, by folder id. */
export function fetchFolderContents(
  folderId: string,
  options: {
    limit?: number;
    offset?: number;
    safeOrderBy?: OrderBy;
    safeOrderDirection?: OrderDirection;
  } = {},
) {
  const {
    limit = -1,
    offset = 0,
    safeOrderBy = "createdAt",
    safeOrderDirection = "DESC",
  } = options;

  const files = db
    .select()
    .from(filesTable)
    .where(eq(filesTable.folderId, folderId))
    .orderBy(fileOrderBy(safeOrderBy, safeOrderDirection))
    .limit(limit)
    .offset(offset)
    .all();

  // matching on parentId is exact, unlike a LIKE on the key which breaks for
  // names containing `%` or `_`
  const folders = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.parentId, folderId))
    .all();

  return { files, folders };
}

export async function fetchFolderByKey(
  folderKey: string,
  options?: {
    limit?: number;
    offset?: number;
    safeOrderBy?: OrderBy;
    safeOrderDirection?: OrderDirection;
  },
) {
  const key = normalizeKey(folderKey);

  if (!isValidKey(key)) {
    return { error: { message: "Invalid folder path" }, data: null };
  }

  const folder = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.key, key))
    .get();

  if (!folder) {
    return { error: { message: "Folder not found" }, data: null };
  }

  const { files, folders } = fetchFolderContents(folder.id, options);

  return { data: { files: getFilesWithUrls(files), folders }, error: null };
}
