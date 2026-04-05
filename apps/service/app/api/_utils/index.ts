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

export function getFilesWithUrls(files: File[]) {
  return files.map((file) => ({
    ...file,
    url: `/api/hosting/${file.name}`,
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
    limit: number;
    offset: number;
    safeOrderBy: "created_at" | "updated_at" | "name";
    safeOrderDirection: "ASC" | "DESC";
  },
) {
  const folder = db
    .prepare(`SELECT * FROM folders WHERE path = ?`)
    .get(path.join(BASE_UPLOADS_PATH, folderPath)) as Folder | undefined;

  if (!folder) {
    return { error: { message: "Folder not found" }, data: null };
  }

  let files: File[] = [];

  if (options && Object.keys(options).length > 0) {
    const { limit, offset, safeOrderBy, safeOrderDirection } = options;

    // fetch files in folder
    files = db
      .prepare(
        `SELECT * FROM files WHERE folder_id = ? ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ? OFFSET ?`,
      )
      .all(folder.id, limit, offset) as File[];
  } else {
    files = db
      .prepare(`SELECT * FROM files WHERE folder_id = ?`)
      .all(folder.id) as File[];
  }

  // fetch subfolders in folder
  const searchPattern = path.join(folder.path, "%");
  const excludePattern = path.join(folder.path, "%/%");

  const folders = db
    .prepare(
      `
            SELECT * FROM folders 
            WHERE path LIKE ? 
            AND path NOT LIKE ?
            AND path != ?
          `,
    )
    .all(searchPattern, excludePattern, folder.path) as Folder[];

  return { data: { files: getFilesWithUrls(files), folders }, error: null };
}
