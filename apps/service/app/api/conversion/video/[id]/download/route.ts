import { contentDisposition } from "@/app/api/_utils";
import { streamFileResponse } from "@/lib/http-cache";
import { findVideoJob } from "@/lib/video/jobs";
import { VIDEO_FORMAT_INFO } from "@/utils/conversion";
import { NextRequest } from "next/server";
import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";
import authorizeRequest from "../../../../_utils/authorize-request";
import { jsonError } from "../../../../_utils/conversion";

/** The converted video, once its job is done, with ranges so a download can resume. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { data: auth, error: authError } = await authorizeRequest(request, {
    scope: "files:read",
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  const job = findVideoJob((await params).id, auth.user.id);
  if (!job) {
    return jsonError("No such video conversion, or it has expired", 404);
  }
  if (job.status === "failed") {
    return jsonError(job.error ?? "This video couldn't be converted", 409);
  }
  if (job.status !== "done") {
    return jsonError("This video hasn't finished converting yet", 409);
  }

  let stats: Stats;
  try {
    stats = await stat(job.output);
  } catch {
    return jsonError("No such video conversion, or it has expired", 404);
  }

  return streamFileResponse({
    request,
    path: job.output,
    stats,
    cacheable: false,
    headers: {
      "Content-Type": VIDEO_FORMAT_INFO[job.format].mimeType,
      "Content-Disposition": contentDisposition("attachment", job.name),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
