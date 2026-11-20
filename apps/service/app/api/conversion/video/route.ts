import { BASE_TMP_PATH } from "@/constants";
import { ConversionError } from "@/lib/conversion";
import { isBusy, startVideoJob } from "@/lib/video/jobs";
import { parseVideoOptions } from "@/lib/video/options";
import { probeVideo } from "@/lib/video/probe";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import authorizeRequest from "../../_utils/authorize-request";
import { busy, jsonError, receiveSources } from "../../_utils/conversion";
import { isClientAbort } from "../../_utils/multipart";

/**
 * Starts converting a video and answers 202 with the job, whose status is
 * polled at /api/conversion/video/{id} and whose result is downloaded from
 * /api/conversion/video/{id}/download. The body is JSON `{ fileId, ...options }`
 * for a stored file, or multipart with one `file` and the options as fields.
 */
export async function POST(request: NextRequest) {
  const { data: auth, error: authError } = await authorizeRequest(request, {
    scope: "files:read",
    bucket: "video-conversion",
    limit: 20,
  });
  if (authError) {
    return jsonError(authError.message, authError.status, authError.retryAfter);
  }

  // refuse before a device upload is read, not after
  if (isBusy()) return busy();

  // the job takes this folder over once it starts
  const workDir = path.join(BASE_TMP_PATH, crypto.randomUUID());
  let started = false;

  try {
    const {
      sources: [source],
      fields,
    } = await receiveSources(request, path.join(workDir, "upload"), {
      min: 1,
      max: 1,
    });
    const options = parseVideoOptions(fields);
    const info = await probeVideo(source.path, request.signal);

    const job = await startVideoJob({
      ownerId: auth.user.id,
      source,
      options,
      info,
      workDir,
    });
    if (!job) return busy();
    started = true;

    return NextResponse.json(
      { data: job, error: null },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ConversionError) {
      return jsonError(error.message, error.status);
    }
    if (request.signal.aborted || isClientAbort(error)) {
      return new NextResponse(null, { status: 499 });
    }

    console.error("video conversion error", error);
    return jsonError("Failed to start converting the video", 500);
  } finally {
    if (!started) {
      fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
