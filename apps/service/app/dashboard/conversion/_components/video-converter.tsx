"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/utils";
import {
  formatTimestamp,
  isConvertibleVideo,
  MIN_VIDEO_TARGET_SIZE,
  MP3_KBPS,
  parseTimestamp,
  VIDEO_ACCEPT,
  VIDEO_CODEC_INFO,
  VIDEO_FORMAT_INFO,
  VIDEO_FORMATS,
  VIDEO_FRAME_RATES,
  VIDEO_RESOLUTIONS,
  type VideoQuality,
} from "@/utils/conversion";
import type {
  ApiResponse,
  VideoCodec,
  VideoFormat,
  VideoJob,
} from "@repo/types";
import { AudioLines, Clapperboard, Play } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
  Field,
  SelectedSource,
  sizeChange,
  SourcePicker,
} from "./conversion-parts";
import { requestConversion, type ConversionSource } from "./request-conversion";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  /** Sent, while the server reads the video and queues it. */
  | { phase: "starting" }
  | { phase: "queued"; job: VideoJob }
  | { phase: "converting"; job: VideoJob }
  | { phase: "done"; job: VideoJob }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

const POLL_MS = 1000;
// polls that may fail in a row, e.g. while the network drops, before giving up
const MAX_POLL_FAILURES = 10;

const QUALITIES: Record<VideoQuality | "size", string> = {
  high: "High",
  balanced: "Balanced",
  small: "Smaller file",
  size: "Fit to a size",
};

type Compression = keyof typeof QUALITIES;

const ORIGINAL = "original";

const jobUrl = (id: string) => `/api/conversion/video/${id}`;

function statusOf(job: VideoJob): Status {
  if (job.status === "failed") {
    return {
      phase: "error",
      message: job.error ?? "This video couldn't be converted",
    };
  }
  return { phase: job.status, job };
}

type Problem = { field: "start" | "end" | "size"; message: string };

const TIME_FORMAT =
  'Write times as seconds, or as minutes and seconds such as "1:30".';

/** Says which option can't be sent and why, or null when all can. */
function problemWith({
  start,
  end,
  targetMb,
  fitToSize,
}: {
  start: string;
  end: string;
  targetMb: string;
  fitToSize: boolean;
}): Problem | null {
  const from = start.trim() ? parseTimestamp(start) : 0;
  const to = end.trim() ? parseTimestamp(end) : null;
  if (from === null) return { field: "start", message: TIME_FORMAT };
  if (end.trim() && to === null) return { field: "end", message: TIME_FORMAT };
  if (to !== null && to <= from) {
    return { field: "end", message: "The end must come after the start." };
  }
  if (fitToSize) {
    const bytes = Number(targetMb) * 1024 ** 2;
    if (!Number.isFinite(bytes) || bytes < MIN_VIDEO_TARGET_SIZE) {
      return {
        field: "size",
        message: `The size must be at least ${formatBytes(MIN_VIDEO_TARGET_SIZE)}.`,
      };
    }
  }
  return null;
}

export default function VideoConverter() {
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [jobId, setJobId] = useState<string | null>(null);
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [codec, setCodec] = useState<VideoCodec>("h264");
  const [compression, setCompression] = useState<Compression>("balanced");
  const [targetMb, setTargetMb] = useState("25");
  const [resolution, setResolution] = useState(ORIGINAL);
  const [fps, setFps] = useState(ORIGINAL);
  const [audio, setAudio] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const cancelRef = useRef<(() => void) | null>(null);
  const jobRef = useRef<string | null>(null);
  const id = useId();

  const gif = format === "gif";
  // only the sound, so nothing about the picture applies
  const mp3 = format === "mp3";
  const copy = !gif && !mp3 && codec === "copy";
  const fitToSize = !gif && !mp3 && !copy && compression === "size";
  const busy =
    status.phase === "uploading" ||
    status.phase === "starting" ||
    status.phase === "queued" ||
    status.phase === "converting";
  const problem = problemWith({ start, end, targetMb, fitToSize });
  const label = VIDEO_FORMAT_INFO[format].label;

  // leaving the page stops the conversion, or removes its result from the server
  useEffect(() => {
    const leave = () => {
      cancelRef.current?.();
      const current = jobRef.current;
      jobRef.current = null;
      if (current) {
        void fetch(jobUrl(current), {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };
    // closing the tab never unmounts the page
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  useEffect(() => {
    if (!jobId) return;

    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(jobUrl(jobId), { cache: "no-store" });
        const body: ApiResponse<VideoJob> = await response.json();
        if (stopped) return;
        if (body.error) {
          setStatus({ phase: "error", message: body.error.message });
          return;
        }
        failures = 0;
        setStatus(statusOf(body.data));
        if (body.data.status === "done" || body.data.status === "failed") {
          return;
        }
      } catch {
        if (stopped) return;
        if (++failures >= MAX_POLL_FAILURES) {
          setStatus({
            phase: "error",
            message:
              "Lost touch with the server. Check your connection and try again.",
          });
          return;
        }
      }
      timer = setTimeout(poll, POLL_MS);
    };

    timer = setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  /** Drops the conversion in progress or its result, here and on the server. */
  function discard() {
    cancelRef.current?.();
    cancelRef.current = null;
    const current = jobRef.current;
    jobRef.current = null;
    setJobId(null);
    if (current) {
      void fetch(jobUrl(current), { method: "DELETE", keepalive: true }).catch(
        () => {},
      );
    }
  }

  function reset() {
    discard();
    setStatus(IDLE);
  }

  // a result made with other options would no longer match them
  function forgetResult() {
    if (status.phase === "done" || status.phase === "error") reset();
  }

  function changeFormat(value: string) {
    const next = value as VideoFormat;
    const { codecs } = VIDEO_FORMAT_INFO[next];
    if (codecs.length > 0 && !codecs.includes(codec)) setCodec(codecs[0]);
    // GIFs and MP3s can't be fitted to a size
    if ((next === "gif" || next === "mp3") && compression === "size") {
      setCompression("balanced");
    }
    // GIFs are kept small unless asked otherwise
    if (next === "gif" && format !== "gif") {
      setResolution("480");
      setFps("15");
    } else if (next !== "gif" && format === "gif") {
      setResolution(ORIGINAL);
      setFps(ORIGINAL);
    }
    setFormat(next);
  }

  function options() {
    const sent: Record<string, string | number | boolean> = { format };
    if (!gif && !mp3) sent.codec = codec;
    if (mp3) {
      sent.quality = compression === "size" ? "balanced" : compression;
    } else if (!copy) {
      if (fitToSize) {
        sent.targetSize = Math.round(Number(targetMb) * 1024 ** 2);
      } else {
        sent.quality = compression === "size" ? "balanced" : compression;
      }
      sent.resolution = resolution;
      sent.fps = fps;
    }
    if (!gif && !mp3 && !audio) sent.audio = false;
    if (start.trim()) sent.start = start.trim();
    if (end.trim()) sent.end = end.trim();
    return sent;
  }

  function startConversion() {
    if (!source || busy || problem) return;
    discard();

    setStatus(
      source.kind === "device"
        ? { phase: "uploading", progress: 0 }
        : { phase: "starting" },
    );

    cancelRef.current = requestConversion(
      { url: "/api/conversion/video", source, options: options() },
      {
        onUploadProgress: (fraction) =>
          setStatus(
            fraction < 1
              ? { phase: "uploading", progress: fraction }
              : { phase: "starting" },
          ),
        onProgress: () => {},
        onDone: async (response) => {
          cancelRef.current = null;
          try {
            const body: ApiResponse<VideoJob> = JSON.parse(
              await response.text(),
            );
            if (!body.data) throw new Error(body.error?.message);
            jobRef.current = body.data.id;
            setJobId(body.data.id);
            setStatus(statusOf(body.data));
          } catch {
            setStatus({
              phase: "error",
              message: "The server's answer couldn't be read",
            });
          }
        },
        onError: (message) => {
          cancelRef.current = null;
          setStatus({ phase: "error", message });
        },
      },
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={Clapperboard}
            title="Choose a video to get started"
            hint="MP4, MOV, MKV, WebM, AVI, GIF and more"
            accept={VIDEO_ACCEPT}
            filter={isConvertibleVideo}
            disabled={busy}
            onChoose={(next) => {
              reset();
              setSource(next);
            }}
          />

          {source && (
            <div className="mt-3 rounded-xl border p-4">
              <SelectedSource
                source={source}
                icon={Clapperboard}
                removeLabel="Remove selected video"
                disabled={busy}
                onRemove={() => {
                  reset();
                  setSource(null);
                }}
                action={
                  busy ? (
                    <Button variant="outline" onClick={reset}>
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      disabled={Boolean(problem)}
                      onClick={startConversion}
                    >
                      <Play fill="currentColor" />
                      Convert to {label}
                    </Button>
                  )
                }
              />

              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3">
                <Field id={`${id}-format`} label="Format">
                  <OptionSelect
                    id={`${id}-format`}
                    value={format}
                    disabled={busy}
                    onChange={(value) => {
                      changeFormat(value);
                      forgetResult();
                    }}
                    options={VIDEO_FORMATS.map((value) => ({
                      value,
                      label:
                        value === "mp3"
                          ? "MP3, sound only"
                          : VIDEO_FORMAT_INFO[value].label,
                    }))}
                  />
                </Field>

                <Field
                  id={`${id}-codec`}
                  label="Codec"
                  hint={
                    gif
                      ? "GIFs loop and have no sound"
                      : mp3
                        ? "Keeps only the sound, for any player"
                        : VIDEO_CODEC_INFO[codec].hint
                  }
                >
                  <OptionSelect
                    id={`${id}-codec`}
                    describedBy={`${id}-codec-hint`}
                    value={gif || mp3 ? "" : codec}
                    placeholder="None"
                    disabled={busy || gif || mp3}
                    onChange={(value) => {
                      setCodec(value as VideoCodec);
                      forgetResult();
                    }}
                    options={VIDEO_FORMAT_INFO[format].codecs.map((value) => ({
                      value,
                      label: VIDEO_CODEC_INFO[value].label,
                    }))}
                  />
                </Field>

                <Field
                  id={`${id}-quality`}
                  label="Quality"
                  hint={
                    fitToSize
                      ? "Takes two passes, so about twice as long"
                      : undefined
                  }
                >
                  <OptionSelect
                    id={`${id}-quality`}
                    describedBy={fitToSize ? `${id}-quality-hint` : undefined}
                    // copied streams keep the quality they have
                    value={copy ? "" : compression}
                    placeholder="Original"
                    disabled={busy || copy}
                    onChange={(value) => {
                      setCompression(value as Compression);
                      forgetResult();
                    }}
                    options={(Object.keys(QUALITIES) as Compression[])
                      .filter((value) => !(gif || mp3) || value !== "size")
                      .map((value) => ({
                        value,
                        label:
                          mp3 && value !== "size"
                            ? `${QUALITIES[value]}, ${MP3_KBPS[value]} kbps`
                            : QUALITIES[value],
                      }))}
                  />
                </Field>

                <Field id={`${id}-resolution`} label="Resolution">
                  <OptionSelect
                    id={`${id}-resolution`}
                    value={mp3 ? "" : copy ? ORIGINAL : resolution}
                    placeholder="None"
                    disabled={busy || copy || mp3}
                    onChange={(value) => {
                      setResolution(value);
                      forgetResult();
                    }}
                    options={[
                      { value: ORIGINAL, label: "Original" },
                      ...VIDEO_RESOLUTIONS.map((value) => ({
                        value: String(value),
                        label: value === 2160 ? "2160p (4K)" : `${value}p`,
                      })),
                    ]}
                  />
                </Field>

                <Field id={`${id}-fps`} label="Frame rate">
                  <OptionSelect
                    id={`${id}-fps`}
                    value={mp3 ? "" : copy ? ORIGINAL : fps}
                    placeholder="None"
                    disabled={busy || copy || mp3}
                    onChange={(value) => {
                      setFps(value);
                      forgetResult();
                    }}
                    options={[
                      { value: ORIGINAL, label: "Original" },
                      ...VIDEO_FRAME_RATES.map((value) => ({
                        value: String(value),
                        label: `Up to ${value} fps`,
                      })),
                    ]}
                  />
                </Field>

                <Field id={`${id}-audio`} label="Sound">
                  <OptionSelect
                    id={`${id}-audio`}
                    value={gif || mp3 ? "" : audio ? "keep" : "remove"}
                    placeholder={mp3 ? "Only the sound" : "None"}
                    disabled={busy || gif || mp3}
                    onChange={(value) => {
                      setAudio(value === "keep");
                      forgetResult();
                    }}
                    options={[
                      { value: "keep", label: "Keep" },
                      { value: "remove", label: "Remove" },
                    ]}
                  />
                </Field>

                <Field id={`${id}-start`} label="Start">
                  <Input
                    id={`${id}-start`}
                    placeholder="0:00"
                    inputMode="decimal"
                    value={start}
                    disabled={busy}
                    aria-invalid={problem?.field === "start"}
                    onChange={(event) => {
                      setStart(event.target.value);
                      forgetResult();
                    }}
                  />
                </Field>

                <Field id={`${id}-end`} label="End">
                  <Input
                    id={`${id}-end`}
                    placeholder="End of video"
                    inputMode="decimal"
                    value={end}
                    disabled={busy}
                    aria-invalid={problem?.field === "end"}
                    onChange={(event) => {
                      setEnd(event.target.value);
                      forgetResult();
                    }}
                  />
                </Field>

                {fitToSize && (
                  <Field id={`${id}-size`} label="Size in MB">
                    <Input
                      id={`${id}-size`}
                      type="number"
                      inputMode="decimal"
                      min={0.1}
                      step="any"
                      value={targetMb}
                      disabled={busy}
                      aria-invalid={problem?.field === "size"}
                      onChange={(event) => {
                        setTargetMb(event.target.value);
                        forgetResult();
                      }}
                    />
                  </Field>
                )}
              </div>

              {problem && (
                <p role="alert" className="text-destructive mt-3 text-xs">
                  {problem.message}
                </p>
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
  );
}

function OptionSelect({
  id,
  describedBy,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  /** The id of the field's hint, when it shows one. */
  describedBy?: string;
  value: string;
  options: { value: string; label: ReactNode }[];
  /** Shown when `value` is empty, as for an option that doesn't apply. */
  placeholder?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full" aria-describedby={describedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusPanel({
  status,
}: {
  status: Exclude<Status, { phase: "idle" }>;
}) {
  switch (status.phase) {
    case "error":
      return <ConversionFailed message={status.message} />;
    case "uploading":
      return (
        <ConversionProgress
          label="Uploading video…"
          progress={status.progress}
        />
      );
    case "starting":
      return <ConversionProgress label="Reading video…" progress={null} />;
    case "queued": {
      const ahead = status.job.position ?? 0;
      return (
        <ConversionProgress
          label={
            // nothing ahead, so it starts in a moment
            ahead === 0
              ? "Starting…"
              : `Waiting for ${ahead} ${ahead === 1 ? "video" : "videos"} ahead of it…`
          }
          progress={null}
        />
      );
    }
    case "converting":
      return (
        <ConversionProgress
          label="Converting video…"
          progress={status.job.progress}
        />
      );
    case "done": {
      const { job } = status;
      const kind =
        job.codec && job.codec !== "copy"
          ? `${VIDEO_FORMAT_INFO[job.format].label} · ${VIDEO_CODEC_INFO[job.codec].label}`
          : VIDEO_FORMAT_INFO[job.format].label;
      const details = [
        kind,
        job.width !== null ? `${job.width} × ${job.height}` : null,
        job.duration ? formatTimestamp(job.duration) : null,
        job.size !== null ? formatBytes(job.size) : null,
        job.size !== null ? sizeChange(job.size, job.sourceSize) : null,
      ];

      return (
        <ConversionReady
          title={
            job.format === "mp3" ? "Your MP3 is ready" : "Your video is ready"
          }
          preview={
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {job.format === "mp3" ? (
                <AudioLines size={18} />
              ) : (
                <Clapperboard size={18} />
              )}
            </div>
          }
          name={job.name}
          details={details.filter(Boolean).join(" · ")}
          url={`${jobUrl(job.id)}/download`}
          downloadLabel={`Download ${VIDEO_FORMAT_INFO[job.format].label}`}
        />
      );
    }
  }
}
