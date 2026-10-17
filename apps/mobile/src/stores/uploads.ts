import type Vaze from "@darseen/vaze";
import type { FileReference } from "@darseen/vaze";
import {
  Directory,
  File as DeviceFile,
  Paths,
  UploadTask,
  UploadType,
  type UploadResult,
} from "expo-file-system";
import { create } from "zustand";
import { useLibrary } from "./library";

export type Upload = {
  id: string;
  batch: string;
  serverId: string;
  folderKey: string;
  name: string;
  size: number;
  /** Percent of the file sent so far. */
  progress: number;
  /** Bytes per second sent lately, once there's been time to measure it. */
  speed?: number;
  status: "queued" | "uploading" | "done" | "failed" | "canceled";
  error?: string;
};

export const isRunning = (upload: Upload) =>
  upload.status === "queued" || upload.status === "uploading";

type UploadsState = {
  uploads: Upload[];
  /** Uploads one file per request so each finishes, fails or cancels on its own. */
  start: (
    serverId: string,
    vaze: Vaze,
    folderKey: string,
    files: FileReference[],
  ) => Promise<{ uploaded: number; failed: Upload[]; canceled: number }>;
  cancel: (id: string) => void;
};

// the shown speed changes once a second, slow enough to read, and is the
// average of the last three
const SPEED_TICK_MS = 1000;
const SPEED_WINDOW_TICKS = 3;

let counter = 0;
// the request of each upload in flight, so cancel can stop it midway
const tasks = new Map<string, UploadTask>();

/** Moves a picked file into its own folder under the name the server should keep. */
async function stage(file: FileReference, id: string) {
  const folder = new Directory(Paths.cache, "uploads", id);
  folder.create({ intermediates: true, idempotent: true });
  const staged = new DeviceFile(folder, file.name);
  const source = new DeviceFile(file.uri);
  // the multipart part is named after the file on disk, and pickers rename it
  try {
    await source.move(staged);
  } catch {
    await source.copy(staged);
  }
  return { staged, folder };
}

/** Deletes a picker's cached copy, never a file outside the app's cache. */
function discard(uri: string) {
  try {
    const file = new DeviceFile(uri);
    if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
  } catch {
    // already gone
  }
}

/**
 * Averages an upload's speed over the last few seconds, so a burst or a lull
 * doesn't swing it, and reports it once a second. It ticks on its own, so a
 * stalled upload falls to 0 instead of holding its last speed.
 */
function speedMeter(report: (speed: number) => void) {
  let sent = 0;
  const samples = [{ at: Date.now(), sent }];

  const timer = setInterval(() => {
    const at = Date.now();
    samples.push({ at, sent });
    if (samples.length > SPEED_WINDOW_TICKS + 1) samples.shift();
    const [first] = samples;
    report(Math.round(((sent - first.sent) / (at - first.at)) * 1000));
  }, SPEED_TICK_MS);

  return {
    update: (bytes: number) => {
      sent = bytes;
    },
    stop: () => clearInterval(timer),
  };
}

function failureOf(result: UploadResult) {
  if (result.status >= 200 && result.status < 300) return null;
  try {
    const body = JSON.parse(result.body) as { error?: { message?: string } };
    if (body.error?.message) return body.error.message;
  } catch {
    // not a JSON error body
  }
  return `Upload failed (${result.status})`;
}

export const useUploads = create<UploadsState>()((set, get) => ({
  uploads: [],

  start: async (serverId, vaze, folderKey, files) => {
    const batch = `${Date.now()}-${counter++}`;
    const queued: Upload[] = files.map((file, index) => ({
      id: `${batch}-${index}`,
      batch,
      serverId,
      folderKey,
      name: file.name,
      size: new DeviceFile(file.uri).size ?? 0,
      progress: 0,
      status: "queued",
    }));

    const patch = (id: string, next: Partial<Upload>) =>
      set((state) => ({
        uploads: state.uploads.map((upload) =>
          upload.id === id ? { ...upload, ...next } : upload,
        ),
      }));
    const statusOf = (id: string) =>
      get().uploads.find((upload) => upload.id === id)?.status;

    set((state) => ({ uploads: [...state.uploads, ...queued] }));
    const started = new Set<string>();

    for (const [index, file] of files.entries()) {
      const { id } = queued[index];
      if (statusOf(id) !== "queued") continue;
      patch(id, { status: "uploading" });
      started.add(id);

      let folder: Directory | null = null;
      let meter: ReturnType<typeof speedMeter> | null = null;
      try {
        const staging = await stage(file, id);
        folder = staging.folder;
        let shown = 0;
        meter = speedMeter((speed) => patch(id, { speed }));
        const task = new UploadTask(staging.staged, vaze.files.uploadUrl(), {
          httpMethod: "POST",
          uploadType: UploadType.MULTIPART,
          fieldName: "files",
          mimeType: file.type,
          parameters: folderKey ? { folder: folderKey } : undefined,
          headers: await vaze.authHeaders(),
          onProgress: ({ bytesSent, totalBytes }) => {
            const progress =
              totalBytes > 0
                ? Math.min(100, Math.floor((bytesSent / totalBytes) * 100))
                : 0;
            meter?.update(bytesSent);
            // whole percents only, so a big file doesn't re-render per chunk
            if (progress === shown) return;
            shown = progress;
            patch(id, { progress });
          },
        });
        tasks.set(id, task);
        // canceled while it was being staged
        if (statusOf(id) === "canceled") continue;

        const failure = failureOf(await task.uploadAsync());
        patch(
          id,
          failure
            ? { status: "failed", error: failure }
            : { status: "done", progress: 100 },
        );
        if (!failure)
          useLibrary.getState().loadFolder(serverId, vaze, folderKey);
      } catch (error) {
        if (statusOf(id) !== "canceled") {
          patch(id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Upload failed",
          });
        }
      } finally {
        meter?.stop();
        tasks.get(id)?.release();
        tasks.delete(id);
        try {
          folder?.delete();
        } catch {
          // already gone
        }
      }
    }

    // staged files are deleted as they finish; these were canceled before staging
    for (const [index, file] of files.entries()) {
      if (!started.has(queued[index].id)) discard(file.uri);
    }

    const finished = get().uploads.filter((upload) => upload.batch === batch);
    set((state) => ({
      uploads: state.uploads.filter((upload) => upload.batch !== batch),
    }));

    // the server records the canceled requests itself, but never saw these
    const unsent = finished
      .filter(
        (upload) => upload.status === "canceled" && !started.has(upload.id),
      )
      .map((upload) => upload.name);
    if (unsent.length > 0) void vaze.files.reportCanceled(unsent);

    return {
      uploaded: finished.filter((upload) => upload.status === "done").length,
      failed: finished.filter((upload) => upload.status === "failed"),
      canceled: finished.filter((upload) => upload.status === "canceled")
        .length,
    };
  },

  cancel: (id) => {
    const upload = get().uploads.find((item) => item.id === id);
    if (!upload || !isRunning(upload)) return;
    set((state) => ({
      uploads: state.uploads.map((item) =>
        item.id === id ? { ...item, status: "canceled" } : item,
      ),
    }));
    tasks.get(id)?.cancel();
  },
}));
