"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/utils";
import { CheckCircle2, CircleSlash, Loader2, X, XCircle } from "lucide-react";
import { useUploadActions, useUploads, type Upload } from "./provider";

const STATUS_LABELS: Record<Upload["status"], string> = {
  queued: "Waiting",
  uploading: "Uploading",
  success: "Uploaded",
  error: "Failed",
  canceled: "Canceled",
};

function StatusIcon({ status }: { status: Upload["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="size-4 shrink-0 text-green-600" />;
    case "error":
      return <XCircle className="text-destructive size-4 shrink-0" />;
    case "canceled":
      return <CircleSlash className="text-muted-foreground size-4 shrink-0" />;
    default:
      return (
        <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
      );
  }
}

function UploadRow({ upload }: { upload: Upload }) {
  const { cancel } = useUploadActions();
  const isRunning = upload.status === "queued" || upload.status === "uploading";
  // the request body is sent well before the server has committed the file
  const label =
    upload.status === "uploading" && upload.progress === 100
      ? "Finishing"
      : STATUS_LABELS[upload.status];

  return (
    <li className="space-y-1.5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <StatusIcon status={upload.status} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {upload.name}
        </span>
        {isRunning && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => cancel(upload.id)}
            aria-label={`Cancel upload of ${upload.name}`}
            title="Cancel"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {isRunning && <Progress value={upload.progress} />}

      {/* the panel is the only report an upload gets, so an error spells itself
          out here instead of truncating */}
      {upload.status === "error" && upload.error ? (
        <p className="text-destructive line-clamp-2 text-xs">{upload.error}</p>
      ) : (
        <p className="text-muted-foreground truncate text-xs">
          {`${label} · ${formatBytes(upload.size)}${
            upload.status === "uploading" ? ` · ${upload.progress}%` : ""
          }`}
        </p>
      )}
    </li>
  );
}

export default function UploadsPanel() {
  const uploads = useUploads();
  const { cancelAll, clearFinished } = useUploadActions();

  if (uploads.length === 0) return null;

  const running = uploads.filter(
    (upload) => upload.status === "queued" || upload.status === "uploading",
  ).length;
  const finished = uploads.length - running;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))]">
      <div className="bg-card/95 rounded-xl border shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <h2 className="flex-1 text-sm font-semibold">
            {running > 0
              ? `Uploading ${running} ${running === 1 ? "file" : "files"}`
              : "Uploads"}
          </h2>

          {running > 0 ? (
            <Button variant="ghost" size="sm" onClick={cancelAll}>
              Cancel all
            </Button>
          ) : (
            finished > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFinished}>
                Clear
              </Button>
            )
          )}
        </div>

        <ul className="max-h-72 divide-y overflow-y-auto">
          {uploads.map((upload) => (
            <UploadRow key={upload.id} upload={upload} />
          ))}
        </ul>
      </div>
    </div>
  );
}
