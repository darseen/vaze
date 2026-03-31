import { readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";

const TARGET_DIR_NAMES = new Set(["node_modules", ".turbo", "dist"]);
const TARGET_EXACT_PATHS = new Set([
  join("apps", "docs", ".next"),
  join("apps", "service", ".next"),
]);

async function findDirsToDelete(currentDir, rootDir, foundDirs = []) {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(currentDir, entry.name);
        const relPath = relative(rootDir, fullPath);

        if (
          TARGET_DIR_NAMES.has(entry.name) ||
          TARGET_EXACT_PATHS.has(relPath)
        ) {
          foundDirs.push(fullPath);
        } else {
          await findDirsToDelete(fullPath, rootDir, foundDirs);
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`Could not read directory ${currentDir}: ${err.message}`);
    }
  }
  return foundDirs;
}

async function main() {
  const projectRoot = process.cwd();
  console.log(`Starting cleanup in ${projectRoot}...`);

  // Find all directories matching the patterns using native Node.js
  const dirsToDelete = await findDirsToDelete(projectRoot, projectRoot);

  if (dirsToDelete.length === 0) {
    console.log("Project is already clean!");
    return;
  }

  console.log("Found the following items to remove:");

  await Promise.all(
    dirsToDelete.map(async (dir) => {
      const relativeDir = relative(projectRoot, dir);
      try {
        await rm(dir, { recursive: true, force: true });
        console.log(`Removed: ${relativeDir}`);
      } catch (err) {
        console.error(`Error removing ${relativeDir}: ${err.message}`);
      }
    }),
  );

  console.log("Cleanup complete!");
}

main().catch((err) => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
