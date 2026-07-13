import db from "@/db";
import { File, Folder } from "@repo/types";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { renameSync } from "node:fs";
import path from "node:path";
import { accessPathSync, isValidName } from "../_utils";
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

    // Folder names must be a single path segment with no dots (consistent with
    // folder creation) so a rename can never escape its parent directory.
    if (!isValidName(name, { allowDots: false })) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid folder name" } },
        { status: 400 },
      );
    }

    // find in database
    const folder = db.prepare(`SELECT * FROM folders WHERE id = ?`).get(id) as
      | Folder
      | undefined;

    if (!folder) {
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    // check if folder exists on disk
    if (!accessPathSync(folder.path)) {
      // drop the orphaned row and report it as gone
      db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
      return NextResponse.json(
        { data: null, error: { message: "Folder not found" } },
        { status: 404 },
      );
    }

    // no-op rename
    if (folder.name === name) {
      return NextResponse.json({ data: null, error: null });
    }

    const oldPath = folder.path;
    const newPath = path.join(path.dirname(oldPath), name);

    // check for name conflicts among siblings (parent_id may be NULL for root)
    const conflictCheck = db
      .prepare(
        `SELECT id FROM folders WHERE parent_id ${
          folder.parent_id === null ? "IS NULL" : "= ?"
        } AND name = ?`,
      )
      .get(
        ...(folder.parent_id === null
          ? [name]
          : [folder.parent_id, name]),
      ) as Pick<Folder, "id"> | undefined;

    if (conflictCheck) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `A folder named "${name}" already exists in this directory.`,
          },
        },
        { status: 409 },
      );
    }

    // Rename on disk first, then update the DB (folder + all descendant paths)
    // atomically. If the DB write fails, roll the disk rename back.
    let renamed = false;
    try {
      renameSync(oldPath, newPath);
      renamed = true;

      const updateTx = db.transaction(() => {
        db.prepare(
          "UPDATE folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(name, newPath, id);
        updateDescendantPaths(id, newPath);
      });
      updateTx();
    } catch (error) {
      console.log("update folder error", error);
      if (renamed) {
        try {
          renameSync(newPath, oldPath);
        } catch {
          // best-effort rollback
        }
      }
      return NextResponse.json(
        { data: null, error: { message: "Error renaming folder" } },
        { status: 500 },
      );
    }

    revalidatePath("/dashboard");
    return NextResponse.json({ data: null, error: null });
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
