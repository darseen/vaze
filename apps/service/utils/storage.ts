import { readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";

export async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }

  return totalSize;
}

export async function getAvailableStorage(dirPath: string) {
  let availableBytes = 0;

  try {
    const stats = await statfs(dirPath);

    availableBytes = stats.bavail * stats.bsize;
  } catch (error) {
    console.error("Failed to get file system stats:", error);
  }

  return availableBytes;
}
