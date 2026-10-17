"use client";

import { callApi } from "@/utils/api";
import type { ApiResponse } from "@repo/types";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type UploadStatus =
  "queued" | "uploading" | "success" | "error" | "canceled";

export interface Upload {
  id: string;
  name: string;
  /** Subfolder path inside the target folder, "" when it lands right in it. */
  dir: string;
  size: number;
  /** Percentage of the request body sent so far. */
  progress: number;
  /** Bytes per second sent lately, once there's been time to measure it. */
  speed?: number;
  status: UploadStatus;
  error?: string;
}

/** A file plus the subfolder it sits in when it came from a folder upload. */
export interface UploadItem {
  file: File;
  dir: string;
}

export interface UploadActions {
  /** Queue one request per file so each gets its own progress and cancel. */
  enqueue: (items: UploadItem[], folder: string) => void;
  cancel: (id: string) => void;
  cancelAll: () => void;
  clearFinished: () => void;
}

interface QueuedUpload {
  id: string;
  file: File;
  folder: string;
}

const MAX_CONCURRENT_UPLOADS = 3;
const SUCCESS_ROW_TTL = 5000;
const RATE_LIMIT_FALLBACK_MS = 5000;
// the shown speed changes once a second, slow enough to read, and is the
// average of the last three
const SPEED_TICK_MS = 1000;
const SPEED_WINDOW_TICKS = 3;

// a counter, not `crypto.randomUUID()`, which needs a secure context — an
// instance served over plain HTTP on a LAN does not have one
let lastUploadId = 0;

const UploadsStateContext = createContext<Upload[] | null>(null);
const UploadActionsContext = createContext<UploadActions | null>(null);

export function useUploads() {
  const uploads = useContext(UploadsStateContext);
  if (!uploads)
    throw new Error("useUploads must be used inside UploadsProvider");
  return uploads;
}

export function useUploadActions() {
  const actions = useContext(UploadActionsContext);
  if (!actions)
    throw new Error("useUploadActions must be used inside UploadsProvider");
  return actions;
}

/** A folder picker gives each file its path in `webkitRelativePath`. */
export function pickedItems(files: Iterable<File>): UploadItem[] {
  return Array.from(files, (file) => ({
    file,
    dir: file.webkitRelativePath.split("/").slice(0, -1).join("/"),
  }));
}

/** Pull the API error message out of an XHR, falling back to its status. */
function errorMessageOf(xhr: XMLHttpRequest): string | null {
  let message: string | null = null;

  try {
    const body = JSON.parse(xhr.responseText) as ApiResponse<unknown>;
    message = body.error?.message ?? null;
  } catch {
    message = null;
  }

  if (message) return message;
  if (xhr.status >= 200 && xhr.status < 300) return null;
  return `Upload failed (${xhr.status || "network error"})`;
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

/** History for uploads dropped from the queue; failing it changes nothing. */
function reportCanceled(names: string[]) {
  if (names.length === 0) return;
  callApi("/api/files/canceled", "POST", { names }).catch(() => {});
}

export default function UploadsProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<Upload[]>([]);

  const queue = useRef<QueuedUpload[]>([]);
  const active = useRef(new Map<string, XMLHttpRequest>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const succeeded = useRef(0);
  // set while rate limited; a timer clears it and restarts the queue
  const paused = useRef(false);

  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const actions = useMemo<UploadActions>(() => {
    const patch = (id: string, changes: Partial<Upload>) =>
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === id ? { ...upload, ...changes } : upload,
        ),
      );

    const remove = (id: string) =>
      setUploads((prev) => prev.filter((upload) => upload.id !== id));

    const forget = (id: string) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        remove(id);
      }, SUCCESS_ROW_TTL);
      timers.current.add(timer);
    };

    // the limit counts every request from this client, so the whole queue waits
    const backOff = (job: QueuedUpload, xhr: XMLHttpRequest) => {
      const seconds = Number(xhr.getResponseHeader("Retry-After"));
      const delay = seconds > 0 ? seconds * 1000 : RATE_LIMIT_FALLBACK_MS;

      queue.current.unshift(job);
      patch(job.id, { status: "queued", progress: 0, speed: undefined });

      if (paused.current) return;
      paused.current = true;

      const timer = setTimeout(() => {
        timers.current.delete(timer);
        paused.current = false;
        pump();
      }, delay);
      timers.current.add(timer);
    };

    const start = (job: QueuedUpload) => {
      const { id, file, folder } = job;
      const body = new FormData();
      body.append("files", file);
      body.append("folder", folder);

      const xhr = new XMLHttpRequest();
      const meter = speedMeter((speed) => patch(id, { speed }));
      active.current.set(id, xhr);
      patch(id, { status: "uploading" });

      // `event.total` covers the multipart envelope, not just the file bytes
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total === 0) return;
        meter.update(event.loaded);
        patch(id, { progress: Math.round((event.loaded / event.total) * 100) });
      };

      // no toasts anywhere in here: the panel is the upload notification, and a
      // toast would land on top of it
      xhr.onload = () => {
        if (xhr.status === 429) return backOff(job, xhr);

        const message = errorMessageOf(xhr);
        if (message) return patch(id, { status: "error", error: message });

        succeeded.current += 1;
        patch(id, { status: "success", progress: 100 });
        forget(id);
      };

      xhr.onerror = () =>
        patch(id, { status: "error", error: "Network error" });

      xhr.onabort = () => patch(id, { status: "canceled" });

      xhr.onloadend = () => {
        meter.stop();
        active.current.delete(id);
        pump();
      };

      xhr.open("POST", "/api/files");
      xhr.send(body);
    };

    function pump() {
      while (
        !paused.current &&
        active.current.size < MAX_CONCURRENT_UPLOADS &&
        queue.current.length > 0
      ) {
        start(queue.current.shift()!);
      }

      if (active.current.size > 0 || queue.current.length > 0) return;

      // the queue just drained: pull the new rows in once for the whole batch
      if (succeeded.current > 0) {
        succeeded.current = 0;
        routerRef.current.refresh();
      }
    }

    return {
      enqueue: (items, folder) => {
        if (items.length === 0) return;

        const queued = items.map(({ file, dir }) => ({
          id: `upload-${++lastUploadId}`,
          file,
          dir,
          folder: [folder, dir].filter(Boolean).join("/"),
        }));

        setUploads((prev) => [
          ...prev,
          ...queued.map(({ id, file, dir }) => ({
            id,
            name: file.name,
            dir,
            size: file.size,
            progress: 0,
            status: "queued" as const,
          })),
        ]);

        queue.current.push(...queued);
        pump();
      },

      cancel: (id) => {
        const xhr = active.current.get(id);
        // an in-flight cancel is logged server-side, off the aborted request
        if (xhr) return xhr.abort();

        const dropped = queue.current.find((upload) => upload.id === id);
        queue.current = queue.current.filter((upload) => upload.id !== id);
        if (dropped) reportCanceled([dropped.file.name]);
        patch(id, { status: "canceled" });
        pump();
      },

      cancelAll: () => {
        const pending = queue.current;
        queue.current = [];
        reportCanceled(pending.map((queued) => queued.file.name));
        const pendingIds = new Set(pending.map((queued) => queued.id));
        setUploads((prev) =>
          prev.map((upload) =>
            pendingIds.has(upload.id)
              ? { ...upload, status: "canceled" as const }
              : upload,
          ),
        );

        for (const xhr of active.current.values()) xhr.abort();
        pump();
      },

      clearFinished: () =>
        setUploads((prev) =>
          prev.filter(
            (upload) =>
              upload.status === "queued" || upload.status === "uploading",
          ),
        ),
    };
  }, []);

  const activeCount = uploads.filter(
    (upload) => upload.status === "queued" || upload.status === "uploading",
  ).length;

  useEffect(() => {
    if (activeCount === 0) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [activeCount]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <UploadActionsContext.Provider value={actions}>
      <UploadsStateContext.Provider value={uploads}>
        {children}
      </UploadsStateContext.Provider>
    </UploadActionsContext.Provider>
  );
}
