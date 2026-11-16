"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/utils";
import { expectedMp3Bytes, isVideo, toMp3Name } from "@/utils/conversion";
import { AudioLines, FileVideo, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
  SelectedSource,
  SourcePicker,
} from "./conversion-parts";
import { requestConversion, type ConversionSource } from "./request-conversion";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "converting"; progress: number | null; received: number }
  | { phase: "done"; url: string; name: string; size: number }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

/** The MP3's size follows from the duration the server reports. */
function expectedSize(header: (name: string) => string | null) {
  const duration = Number(header("X-Content-Duration"));
  return duration > 0 ? expectedMp3Bytes(duration) : null;
}

export default function VideoToAudio() {
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
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

    cancelRef.current = requestConversion(
      { url: "/api/conversion/video-to-audio", source, expectedSize },
      {
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
      },
    );
  }

  function cancelConversion() {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus(IDLE);
  }

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={FileVideo}
            title="Choose a video to get started"
            hint="MP4, MOV, MKV, WebM, AVI and more"
            accept="video/*"
            filter={isVideo}
            disabled={busy}
            onChoose={choose}
          />

          {source && (
            <div className="mt-3 rounded-xl border p-4">
              <SelectedSource
                source={source}
                icon={FileVideo}
                removeLabel="Remove selected video"
                disabled={busy}
                onRemove={() => {
                  setSource(null);
                  setStatus(IDLE);
                }}
                action={
                  busy ? (
                    <Button variant="outline" onClick={cancelConversion}>
                      Cancel
                    </Button>
                  ) : (
                    <Button onClick={startConversion}>
                      <Play fill="currentColor" />
                      Convert to audio
                    </Button>
                  )
                }
              />
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
  );
}

function StatusPanel({
  status,
}: {
  status: Exclude<Status, { phase: "idle" }>;
}) {
  if (status.phase === "error") {
    return <ConversionFailed message={status.message} />;
  }

  if (status.phase === "done") {
    return (
      <ConversionReady
        title="Your audio is ready"
        preview={
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <AudioLines size={18} />
          </div>
        }
        name={status.name}
        details={`MP3 audio · ${formatBytes(status.size)}`}
        url={status.url}
        downloadLabel="Download MP3"
      />
    );
  }

  return status.phase === "uploading" ? (
    <ConversionProgress label="Uploading video…" progress={status.progress} />
  ) : (
    <ConversionProgress
      label="Extracting audio…"
      progress={status.progress}
      received={status.received}
    />
  );
}
