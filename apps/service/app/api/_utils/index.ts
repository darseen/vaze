import { BASE_UPLOADS_PATH } from "@/constants";
import db from "@/db";
import { File, Folder } from "@repo/types";
import crypto from "node:crypto";
import { accessSync } from "node:fs";
import fs, { access, constants } from "node:fs/promises";
import path from "node:path";

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
    .prepare(`SELECT * FROM folders WHERE path = ?`)
    .get(BASE_UPLOADS_PATH) as Folder | undefined;

  if (!baseFolder) {
    await fs.mkdir(BASE_UPLOADS_PATH, { recursive: true });
    const baseId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO folders (id, name, path, parent_id) VALUES (?, ?, ?, ?)`,
    ).run(baseId, path.basename(BASE_UPLOADS_PATH), BASE_UPLOADS_PATH, null);

    baseFolder = db
      .prepare(`SELECT * FROM folders WHERE path = ?`)
      .get(BASE_UPLOADS_PATH) as Folder;
  }

  if (!folderPath) return baseFolder as Folder;

  const pathSegments = folderPath.split("/").filter(Boolean);
  let currentPath = BASE_UPLOADS_PATH;
  let currentParentId: string | null = baseFolder?.id || null;

  for (const segment of pathSegments) {
    const segmentAbsolutePath = path.join(currentPath, segment);

    const existingSegment = db
      .prepare(`SELECT id FROM folders WHERE path = ?`)
      .get(segmentAbsolutePath) as Pick<Folder, "id"> | undefined;

    if (existingSegment) {
      currentPath = segmentAbsolutePath;
      currentParentId = existingSegment.id;
    } else {
      await fs.mkdir(segmentAbsolutePath, { recursive: true });

      const newSegmentId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO folders (id, name, path, parent_id) VALUES (?, ?, ?, ?)`,
      ).run(newSegmentId, segment, segmentAbsolutePath, currentParentId);

      currentPath = segmentAbsolutePath;
      currentParentId = newSegmentId;
    }
  }

  const targetAbsolutePath = path.join(BASE_UPLOADS_PATH, folderPath);
  const targetFolder = db
    .prepare(`SELECT * FROM folders WHERE path = ?`)
    .get(targetAbsolutePath) as Folder | undefined;

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
    .prepare(`SELECT * FROM folders WHERE path = ?`)
    .get(path.join(BASE_UPLOADS_PATH, folderPath)) as Folder | undefined;

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
    .prepare(
      `SELECT * FROM files WHERE folder_id = ? ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
    )
    .all(folder.id, limit, offset) as File[];

  // fetch direct subfolders (matching on parent_id is exact, unlike a LIKE on
  // the path which breaks for names containing `%` or `_`).
  const folders = db
    .prepare(`SELECT * FROM folders WHERE parent_id = ?`)
    .all(folder.id) as Folder[];

  return { data: { files: getFilesWithUrls(files), folders }, error: null };
}
