import { statfs } from "node:fs/promises";

export async function getAvailableStorage(dirPath: string) {
  return (await getVolumeUsage(dirPath)).available;
}

/**
 * Free and usable bytes on the volume holding `dirPath`. Blocks reserved for
 * root are left out of both, so `available` can reach zero while
 * `capacity` still counts everything Vaze could have used.
 */
export async function getVolumeUsage(dirPath: string) {
  try {
    const stats = await statfs(dirPath);
    const reserved = stats.bfree - stats.bavail;

    return {
      available: stats.bavail * stats.bsize,
      capacity: (stats.blocks - reserved) * stats.bsize,
    };
  } catch (error) {
    console.error("Failed to get file system stats:", error);
    return { available: 0, capacity: 0 };
  }
}
