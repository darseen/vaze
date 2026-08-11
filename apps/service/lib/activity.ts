import { db } from "@/db";
import { activities, type ActivityType } from "@repo/db";
import type { ApiResponse } from "@repo/types";
import crypto from "node:crypto";

interface ActivityEntry {
  userId: string;
  type: ActivityType;
  target?: string | null;
  detail?: string | null;
}

/** Best-effort: a history row must never fail the action it describes. */
export function recordActivity({
  userId,
  type,
  target = null,
  detail = null,
}: ActivityEntry) {
  try {
    db.insert(activities)
      .values({ id: crypto.randomUUID(), userId, type, target, detail })
      .run();
  } catch (error) {
    console.error("failed to record activity", error);
  }
}

/**
 * One request covers a single name or a batch, so name it accordingly: the
 * target is what the row is titled with, the detail spells a batch out.
 */
export function summarizeNames(
  names: string[],
  noun = "files",
): { target: string | null; detail: string | null } {
  if (names.length === 0) return { target: null, detail: null };
  if (names.length === 1) return { target: names[0], detail: null };

  return {
    target: `${names.length} ${noun}`,
    detail:
      names.length <= 3
        ? names.join(", ")
        : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`,
  };
}

/** What a delete request managed to remove, and what it choked on. */
export function recordFileDeletions(
  userId: string,
  deleted: string[],
  failed: string[],
) {
  if (deleted.length > 0) {
    recordActivity({
      userId,
      type: "file.deleted",
      ...summarizeNames(deleted),
    });
  }

  if (failed.length > 0) {
    const { target, detail } = summarizeNames(failed);
    recordActivity({
      userId,
      type: "file.delete-failed",
      target,
      detail: detail ?? "Error deleting file",
    });
  }
}

async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as ApiResponse<unknown>;
    if (body.error?.message) return body.error.message;
  } catch {
    // a body-less or non-JSON response falls back to the status
  }
  return `Upload failed (${response.status})`;
}

export interface UploadContext {
  userId: string | null;
  names: string[];
}

/** Turn a finished upload request into a single history row. */
export async function recordUploadActivity(
  response: Response,
  { userId, names }: UploadContext,
) {
  // an unauthorized or rate-limited request belongs to nobody
  if (!userId) return;

  const { target, detail } = summarizeNames(names);

  if (response.status === 499) {
    return recordActivity({ userId, type: "upload.canceled", target, detail });
  }

  if (response.ok) {
    return recordActivity({ userId, type: "upload.succeeded", target, detail });
  }

  recordActivity({
    userId,
    type: "upload.failed",
    target,
    detail: await errorMessageOf(response),
  });
}
