import db, { File, Folder } from "@/db";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { accessSync, renameSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import authorizeRequest from "../_utils/authorize-request";

export default async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request);
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: 401 },
      );
    }
    const { id, name }: { id: string; name: string } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { data: null, error: { message: "Missing id or name" } },
        { status: 400 },
      );
    }

    // made global so that if rename fails, we can rename back to old path
    let oldPath: string | null = null;
    let newPath: string | null = null;

    // Run the entire operation in a transaction
    const updateTx = db.transaction(() => {
      // find in database
      const folder = db
        .prepare(`SELECT * FROM folders WHERE id = ?`)
        .get(id) as Folder | undefined;

      if (!folder) {
        throw new Error("Folder not found");
      }

      try {
        // check if folder exists on disk
        accessSync(folder.path, fs.constants.F_OK);
      } catch {
        // delete folder from database if it doesn't exist on disk
        db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
        throw new Error("Folder not found");
      }

      if (folder.name === name) return;

      oldPath = folder.path;
      const parentPath = path.dirname(oldPath);
      newPath = path.join(parentPath, name);

      // check for name conflicts
      const conflictCheck = db
        .prepare(
          "SELECT id FROM folders WHERE parent_id " +
            (folder.parent_id ? "= ?" : "IS NULL") +
            " AND name = ?",
        )
        .get(folder.parent_id, name) as Pick<Folder, "id"> | undefined;

      if (conflictCheck) {
        throw new Error(
          `A folder named "${name}" already exists in this directory.`,
        );
      }

      // rename folder on disk
      try {
        renameSync(path.join(oldPath), path.join(newPath));
      } catch {
        throw new Error(`Failed to rename folder on disk`);
      }

      // update folder in database
      const updateStmt = db.prepare(
        "UPDATE folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      );
      updateStmt.run(name, newPath, id);

      // recursively update all descendant paths
      updateDescendantPaths(id, newPath);
    });

    try {
      updateTx();

      revalidatePath("/dashboard");
      return NextResponse.json({ data: null, error: null });
    } catch (error) {
      console.log("update folder error", error);
      // rename back to old path
      if (oldPath && newPath) {
        await fs.rename(newPath, oldPath);
      }
      return NextResponse.json(
        { data: null, error: { message: "Internal server error" } },
        { status: 500 },
      );
    }
  } catch (error) {
    console.log("update folder error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

// a function to update all descendant paths recursively
function updateDescendantPaths(parentId: string, newParentPath: string) {
  const subfolders = db
    .prepare("SELECT id, name FROM folders WHERE parent_id = ?")
    .all(parentId) as Folder[];

  const files = db
    .prepare("SELECT id, name FROM files WHERE folder_id = ?")
    .all(parentId) as File[];

  if (subfolders.length === 0 && files.length === 0) return;

  for (const file of files) {
    const newFilePath = path.join(newParentPath, file.name);

    db.prepare("UPDATE files SET path = ? WHERE id = ?").run(
      newFilePath,
      file.id,
    );
  }

  for (const folder of subfolders) {
    const newFolderPath = path.join(newParentPath, folder.name);

    db.prepare("UPDATE folders SET path = ? WHERE id = ?").run(
      newFolderPath,
      folder.id,
    );

    updateDescendantPaths(folder.id, newFolderPath);
  }
}
