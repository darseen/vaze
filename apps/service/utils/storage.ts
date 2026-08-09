import { statfs } from "node:fs/promises";

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
