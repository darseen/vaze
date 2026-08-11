"use server";

import { recordActivity, summarizeNames } from "@/lib/activity";
import auth from "@/utils/auth";

/**
 * Uploads canceled while still queued never reach the API, so the browser is
 * the only place that knows about them. In-flight cancels are recorded by the
 * upload route itself, off the aborted request.
 */
export default async function recordCanceledUploads(names: string[]) {
  const user = await auth();

  if (!user || names.length === 0) return;

  const { target, detail } = summarizeNames(names);

  recordActivity({
    userId: user.id,
    type: "upload.canceled",
    target,
    detail: detail ?? "Canceled before it started",
  });
}
