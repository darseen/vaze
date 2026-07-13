import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { files as filesTable, folders as foldersTable } from "@/db/schema";
import { File } from "@repo/types";
import { asc, desc, eq } from "drizzle-orm";
import { SQLiteColumn } from "drizzle-orm/sqlite-core";
import crypto from "node:crypto";
import { accessSync } from "node:fs";
import fs, { access, constants } from "node:fs/promises";
import path from "node:path";

export type OrderBy = "created_at" | "updated_at" | "name" | "size";
export type OrderDirection = "ASC" | "DESC";

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
 * NUL bytes and `.`/`..` so a rename can never escape its parent directory.
 * Folder names additionally disallow dots to stay consistent with creation.
 */
export function isValidName(
  name: unknown,
  { allowDots = true }: { allowDots?: boolean } = {},
): name is string {
  if (typeof name !== "string" || name.trim().length === 0) return false;
  if (/[/\\\0]/.test(name)) return false;
  if (name === "." || name === "..") return false;
  if (!allowDots && name.includes(".")) return false;
  return true;
}

/**
 * Parse an integer query param, falling back when it is missing or not a
 * finite number (so `?limit=abc` yields the default instead of a 500).
 */
export function parseIntParam(
  value: string | null,
  fallback: number,
): number {
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

export function getFilesWithUrls(files: File[]) {
  return files.map((file) => ({
    ...file,
    url: `api/hosting/${file.name}`,
  }));
}

export async function createNestedFolders(folderPath: string) {
  if (folderPath.includes(".")) {
    throw new Error("Folder name cannot contain dots");
  }

  let baseFolder = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.path, BASE_UPLOADS_PATH))
    .get();

  if (!baseFolder) {
    await fs.mkdir(BASE_UPLOADS_PATH, { recursive: true });
    const baseId = crypto.randomUUID();
    db.insert(foldersTable)
      .values({
        id: baseId,
        name: path.basename(BASE_UPLOADS_PATH),
        path: BASE_UPLOADS_PATH,
        parent_id: null,
      })
      .run();

    baseFolder = db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.path, BASE_UPLOADS_PATH))
      .get();
  }

  if (!folderPath) return baseFolder!;

  const pathSegments = folderPath.split("/").filter(Boolean);
  let currentPath = BASE_UPLOADS_PATH;
  let currentParentId: string | null = baseFolder?.id || null;

  for (const segment of pathSegments) {
    const segmentAbsolutePath = path.join(currentPath, segment);

    const existingSegment = db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(eq(foldersTable.path, segmentAbsolutePath))
      .get();

    if (existingSegment) {
      currentPath = segmentAbsolutePath;
      currentParentId = existingSegment.id;
    } else {
      await fs.mkdir(segmentAbsolutePath, { recursive: true });

      const newSegmentId = crypto.randomUUID();
      db.insert(foldersTable)
        .values({
          id: newSegmentId,
          name: segment,
          path: segmentAbsolutePath,
          parent_id: currentParentId,
        })
        .run();

      currentPath = segmentAbsolutePath;
      currentParentId = newSegmentId;
    }
  }

  const targetAbsolutePath = path.join(BASE_UPLOADS_PATH, folderPath);
  const targetFolder = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.path, targetAbsolutePath))
    .get();

  if (!targetFolder) {
    throw new Error("Failed to find or create folder in database.");
  }

  return targetFolder;
}

export async function fetchFolderByPath(
  folderPath: string,
  options?: {
    limit?: number;
    offset?: number;
    safeOrderBy?: "created_at" | "updated_at" | "name" | "size";
    safeOrderDirection?: "ASC" | "DESC";
  },
) {
  const folder = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.path, path.join(BASE_UPLOADS_PATH, folderPath)))
    .get();

  if (!folder) {
    return { error: { message: "Folder not found" }, data: null };
  }

  const {
    limit = -1,
    offset = 0,
    safeOrderBy = "created_at",
    safeOrderDirection = "DESC",
  } = options ?? {};

  // fetch files in folder
  const files = db
    .select()
    .from(filesTable)
    .where(eq(filesTable.folder_id, folder.id))
    .orderBy(fileOrderBy(safeOrderBy, safeOrderDirection))
    .limit(limit)
    .offset(offset)
    .all();

  // fetch direct subfolders (matching on parent_id is exact, unlike a LIKE on
  // the path which breaks for names containing `%` or `_`).
  const folders = db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.parent_id, folder.id))
    .all();

  return { data: { files: getFilesWithUrls(files), folders }, error: null };
}
