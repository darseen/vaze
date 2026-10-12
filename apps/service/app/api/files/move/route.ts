import { MAX_MOVE_BATCH } from "@/constants";
import { db } from "@/db";
import { files as filesTable } from "@repo/db";
import type { File, Folder } from "@repo/types";
import { eq, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  accessPath,
  getFilesWithUrls,
  joinKey,
  revalidateDashboard,
  toStoragePath,
} from "../../_utils";
import authorizeRequest from "../../_utils/authorize-request";
import {
  keyTaken,
  renameOnDisk,
  resolveDestination,
  type MoveDestination,
} from "../../_utils/move";

type MoveOutcome =
  | { file: File; error: null }
  | { file: null; error: { message: string; status: number } };

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await authorizeRequest(request, {
      scope: "files:write",
    });
    if (authError) {
      return NextResponse.json(
        { error: { message: authError.message }, data: null },
        { status: authError.status },
      );
    }

    const body: { id?: string; ids?: string[] } & MoveDestination =
      await request.json();

    // `ids` moves a batch and reports per-file outcomes; `id` answers for one
    const batch = Array.isArray(body.ids);
    const ids = [
      ...new Set(
        (batch ? body.ids! : [body.id]).filter(
          (value): value is string => typeof value === "string" && value !== "",
        ),
      ),
    ];

    if (ids.length === 0) {
      return NextResponse.json(
        {
          data: null,
          error: { message: batch ? "No file ids provided" : "Missing id" },
        },
        { status: 400 },
      );
    }

    if (ids.length > MAX_MOVE_BATCH) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: `Cannot move more than ${MAX_MOVE_BATCH} files at once`,
          },
        },
        { status: 400 },
      );
    }

    const rows = db
      .select()
      .from(filesTable)
      .where(inArray(filesTable.id, ids))
      .all();

    if (rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          error: { message: batch ? "No files found" : "File not found" },
        },
        { status: 404 },
      );
    }

    const { folder: destination, error } = await resolveDestination(body);
    if (error) {
      return NextResponse.json(
        { data: null, error: { message: error.message } },
        { status: error.status },
      );
    }

    const moved: File[] = [];
    const failed: { id: string; message: string }[] = [];
    let firstError: { message: string; status: number } | null = null;

    // one at a time, so two same-named files in a batch can't race for one key
    for (const file of rows) {
      const outcome = await moveFile(file, destination);
      if (outcome.error) {
        failed.push({ id: file.id, message: outcome.error.message });
        firstError ??= outcome.error;
      } else {
        moved.push(outcome.file);
      }
    }

    if (moved.length > 0) revalidateDashboard();

    if (!batch) {
      if (firstError) {
        return NextResponse.json(
          { data: null, error: { message: firstError.message } },
          { status: firstError.status },
        );
      }
      return NextResponse.json({
        data: { file: getFilesWithUrls(moved)[0] },
        error: null,
      });
    }

    const found = new Set(rows.map((file) => file.id));
    for (const id of ids) {
      if (!found.has(id)) failed.push({ id, message: "File not found" });
    }

    return NextResponse.json({
      data: { files: getFilesWithUrls(moved), failed },
      error: null,
    });
  } catch (error) {
    console.error("move file error", error);
    return NextResponse.json(
      { error: { message: "Internal server error" }, data: null },
      { status: 500 },
    );
  }
}

async function moveFile(file: File, destination: Folder): Promise<MoveOutcome> {
  if (file.folderId === destination.id) return { file, error: null };

  const newKey = joinKey(destination.key, file.name);

  if (await keyTaken(newKey)) {
    return {
      file: null,
      error: {
        message: `"${file.name}" already exists in the destination folder`,
        status: 409,
      },
    };
  }

  const currentPath = toStoragePath(file.key);
  if (!(await accessPath(currentPath))) {
    return { file: null, error: { message: "File not found", status: 404 } };
  }

  try {
    const updated = await renameOnDisk(currentPath, toStoragePath(newKey), () =>
      db
        .update(filesTable)
        .set({
          folderId: destination.id,
          key: newKey,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(filesTable.id, file.id))
        .returning()
        .get(),
    );

    return { file: updated, error: null };
  } catch (error) {
    console.error("move file error", error);
    return { file: null, error: { message: "Error moving file", status: 500 } };
  }
}
