"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/utils";
import { isVideo, toMp3Name } from "@/utils/conversion";
import {
  AudioLines,
  Check,
  CircleAlert,
  Cloud,
  Download,
  FileVideo,
  LoaderCircle,
  Play,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import FileSelector from "./file-selector";
import { requestConversion, type ConversionSource } from "./request-conversion";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "converting"; progress: number | null; received: number }
  | { phase: "done"; url: string; name: string; size: number }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

export default function VideoToAudio() {
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const busy = status.phase === "uploading" || status.phase === "converting";
  const audioUrl = status.phase === "done" ? status.url : null;

  // leaving the page cancels the request, which stops ffmpeg on the server
  useEffect(() => () => cancelRef.current?.(), []);

  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function choose(next: ConversionSource) {
    setSource(next);
    setStatus(IDLE);
    setIsFileSelectorOpen(false);
  }

  function handleDeviceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // lets the same file be picked again
    event.target.value = "";
    if (file) choose({ kind: "device", file });
  }

  function startConversion() {
    if (!source || busy) return;

    const name = toMp3Name(source.file.name);
    const finish = (next: Status) => {
      cancelRef.current = null;
      setStatus(next);
    };

    setStatus(
      source.kind === "device"
        ? { phase: "uploading", progress: 0 }
        : { phase: "converting", progress: null, received: 0 },
    );

    cancelRef.current = requestConversion(source, {
      onUploadProgress: (fraction) =>
        setStatus(
          // once sent, the server reads the video before audio comes back
          fraction < 1
            ? { phase: "uploading", progress: fraction }
            : { phase: "converting", progress: null, received: 0 },
        ),
      onProgress: (received, progress) =>
        setStatus({ phase: "converting", progress, received }),
      onDone: (audio) =>
        finish({
          phase: "done",
          url: URL.createObjectURL(audio),
          name,
          size: audio.size,
        }),
      onError: (message) => finish({ phase: "error", message }),
    });
  }

  function cancelConversion() {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus(IDLE);
  }

  return (
    <>
      <Card>
        <CardContent>
          <div className="sm:p-4">
            <div className="px-5 py-10 text-center sm:px-10">
              <div className="bg-secondary text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                <FileVideo size={27} />
              </div>
              <h2 className="mt-5 text-lg font-semibold">
                Choose a video to get started
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                MP4, MOV, MKV, WebM, AVI and more
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <input
                  ref={inputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleDeviceFile}
                />
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload />
                  Choose from device
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => setIsFileSelectorOpen(true)}
                >
                  <Cloud />
                  Choose from Vaze
                </Button>
              </div>
            </div>

            {source && (
              <div className="mt-3 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-secondary text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <FileVideo size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {source.file.name}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatBytes(source.file.size)} ·{" "}
                      {source.kind === "device" ? "Your device" : "Vaze"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground size-7 shrink-0"
                    disabled={busy}
                    onClick={() => {
                      setSource(null);
                      setStatus(IDLE);
                    }}
                    aria-label="Remove selected video"
                  >
                    <X />
                  </Button>
                </div>
                {busy ? (
                  <Button variant="outline" onClick={cancelConversion}>
                    Cancel
                  </Button>
                ) : (
                  <Button onClick={startConversion}>
                    <Play fill="currentColor" />
                    Convert to audio
                  </Button>
                )}
              </div>
            )}

            {status.phase !== "idle" && (
              <div className="bg-muted/40 mt-3 rounded-xl border p-4">
                <StatusPanel status={status} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <FileSelector
        open={isFileSelectorOpen}
        onOpenChange={setIsFileSelectorOpen}
        accept={isVideo}
        onSelect={(file) => choose({ kind: "vaze", file })}
      />
    </>
  );
}

function StatusPanel({
  status,
}: {
  status: Exclude<Status, { phase: "idle" }>;
}) {
  if (status.phase === "error") {
    return (
      <p
        role="alert"
        className="text-destructive flex items-start gap-2 text-sm"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {status.message}
      </p>
    );
  }

  if (status.phase === "done") {
    return (
      <>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Check size={13} strokeWidth={3} />
          </span>
          Your audio is ready
        </div>
        <div className="bg-card mt-4 flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <AudioLines size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{status.name}</p>
              <p className="text-muted-foreground text-xs">
                MP3 audio · {formatBytes(status.size)}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <a href={status.url} download={status.name}>
              <Download />
              Download MP3
            </a>
          </Button>
        </div>
      </>
    );
  }

  const progress =
    status.progress === null ? null : Math.round(status.progress * 100);

  return (
    <>
      <div
        role="status"
        className="flex items-center justify-between gap-3 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <LoaderCircle className="text-primary size-4 animate-spin" />
          {status.phase === "uploading"
            ? "Uploading video…"
            : "Extracting audio…"}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {progress !== null
            ? `${progress}%`
            : status.phase === "converting" && status.received > 0
              ? formatBytes(status.received)
              : null}
        </span>
      </div>
      {progress !== null && <Progress value={progress} className="mt-3 h-2" />}
    </>
  );
}
