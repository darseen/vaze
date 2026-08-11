"use client";

import recordCanceledUploads from "@/actions/activity/record-canceled-uploads";
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
  | "queued"
  | "uploading"
  | "success"
  | "error"
  | "canceled";

export interface Upload {
  id: string;
  name: string;
  size: number;
  /** Percentage of the request body sent so far. */
  progress: number;
  status: UploadStatus;
  error?: string;
}

export interface UploadActions {
  /** Queue one request per file so each gets its own progress and cancel. */
  enqueue: (files: File[], folder: string) => void;
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

// a counter, not `crypto.randomUUID()`, which needs a secure context — an
// instance served over plain HTTP on a LAN does not have one
let lastUploadId = 0;

const UploadsStateContext = createContext<Upload[] | null>(null);
const UploadActionsContext = createContext<UploadActions | null>(null);

export function useUploads() {
  const uploads = useContext(UploadsStateContext);
  if (!uploads) throw new Error("useUploads must be used inside UploadsProvider");
  return uploads;
}

export function useUploadActions() {
  const actions = useContext(UploadActionsContext);
  if (!actions)
    throw new Error("useUploadActions must be used inside UploadsProvider");
  return actions;
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

/** History for uploads dropped from the queue; failing it changes nothing. */
function reportCanceled(names: string[]) {
  if (names.length === 0) return;
  recordCanceledUploads(names).catch(() => {});
}

export default function UploadsProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<Upload[]>([]);

  const queue = useRef<QueuedUpload[]>([]);
  const active = useRef(new Map<string, XMLHttpRequest>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const succeeded = useRef(0);

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

    const start = ({ id, file, folder }: QueuedUpload) => {
      const body = new FormData();
      body.append("files", file);
      body.append("folder", folder);

      const xhr = new XMLHttpRequest();
      active.current.set(id, xhr);
      patch(id, { status: "uploading" });

      // `event.total` covers the multipart envelope, not just the file bytes
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total === 0) return;
        patch(id, { progress: Math.round((event.loaded / event.total) * 100) });
      };

      // no toasts anywhere in here: the panel is the upload notification, and a
      // toast would land on top of it
      xhr.onload = () => {
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
        active.current.delete(id);
        pump();
      };

      xhr.open("POST", "/api/files");
      xhr.send(body);
    };

    function pump() {
      while (
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
      enqueue: (files, folder) => {
        if (files.length === 0) return;

        const queued = files.map((file) => ({
          id: `upload-${++lastUploadId}`,
          file,
          folder,
        }));

        setUploads((prev) => [
          ...prev,
          ...queued.map(({ id, file }) => ({
            id,
            name: file.name,
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
        setUploads((prev) =>
          prev.map((upload) =>
            pending.some((queued) => queued.id === upload.id)
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
