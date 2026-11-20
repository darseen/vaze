import type {
  File,
  VideoCodec,
  VideoConversionOptions,
  VideoFormat,
  VideoJob,
  VideoQuality,
} from "@darseen/vaze";
import type { File as DeviceFile } from "expo-file-system";
import {
  Button,
  ControlField,
  Description,
  Input,
  Label,
  Spinner,
  useToast,
} from "heroui-native";
import { Clapperboard } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import {
  ChoiceSelect,
  ChoiceTabs,
  Option,
  ToolScroll,
} from "@/components/tool-parts";
import {
  convertVideo,
  formatTimestamp,
  GIF_FRAME_RATE,
  GIF_RESOLUTION,
  MIN_VIDEO_TARGET_SIZE,
  parseTimestamp,
  sizeChange,
  VIDEO_CODEC_INFO,
  VIDEO_FORMAT_INFO,
  VIDEO_FORMATS,
  VIDEO_FRAME_RATES,
  VIDEO_RESOLUTIONS,
  type ConversionSource,
} from "@/lib/conversion";
import { formatBytes } from "@/lib/format";
import { discardPicked, pickOne } from "@/lib/transfer";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
  ResultActions,
  SourceChoices,
  SourceRow,
  type SourceOrigin,
} from "./conversion-parts";
import { FilePickerSheet } from "./file-picker-sheet";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  /** Sent, while the server reads the video and queues it. */
  | { phase: "starting" }
  | { phase: "queued"; position: number }
  | { phase: "converting"; progress: number | null }
  | { phase: "downloading"; progress: number | null }
  | { phase: "done"; video: DeviceFile; job: VideoJob }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

type Compression = VideoQuality | "size";

const COMPRESSIONS: { value: Compression; label: string }[] = [
  { value: "high", label: "High" },
  { value: "balanced", label: "Balanced" },
  { value: "small", label: "Smaller" },
  { value: "size", label: "Fit size" },
];

const ORIGINAL = "original";

const RESOLUTIONS = [
  { value: ORIGINAL, label: "Original" },
  ...VIDEO_RESOLUTIONS.map((value) => ({
    value: String(value),
    label: value === 2160 ? "2160p (4K)" : `${value}p`,
  })),
];

const FRAME_RATES = [
  { value: ORIGINAL, label: "Original" },
  ...VIDEO_FRAME_RATES.map((value) => ({
    value: String(value),
    label: `Up to ${value} fps`,
  })),
];

const TIME_FORMAT =
  'Write times as seconds, or as minutes and seconds such as "1:30".';

/** Says what can't be sent and why, or null when everything can. */
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
}): string | null {
  const from = start.trim() ? parseTimestamp(start) : 0;
  const to = end.trim() ? parseTimestamp(end) : null;
  if (from === null || (end.trim() && to === null)) return TIME_FORMAT;
  if (to !== null && to <= from) return "The end must come after the start.";
  if (fitToSize) {
    const bytes = Number(targetMb) * 1024 ** 2;
    if (!Number.isFinite(bytes) || bytes < MIN_VIDEO_TARGET_SIZE) {
      return `The size must be at least ${formatBytes(MIN_VIDEO_TARGET_SIZE)}.`;
    }
  }
  return null;
}

/** Compresses and converts a video. A stored video's `fileId` is picked, ready for its options. */
export function VideoConverter({ fileId }: { fileId?: string }) {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [codec, setCodec] = useState<VideoCodec>("h264");
  const [compression, setCompression] = useState<Compression>("balanced");
  const [targetMb, setTargetMb] = useState("25");
  const [resolution, setResolution] = useState(ORIGINAL);
  const [fps, setFps] = useState(ORIGINAL);
  const [audio, setAudio] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [finding, setFinding] = useState(Boolean(fileId));
  const [picking, setPicking] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  // events from a canceled run are ignored
  const runRef = useRef(0);

  const gif = format === "gif";
  const copy = !gif && codec === "copy";
  const fitToSize = !gif && !copy && compression === "size";
  const busy =
    status.phase !== "idle" &&
    status.phase !== "done" &&
    status.phase !== "error";
  const result = status.phase === "done" ? status : null;
  const problem = problemWith({ start, end, targetMb, fitToSize });
  const { label, codecs } = VIDEO_FORMAT_INFO[format];

  // leaving the screen stops the conversion, and removes it from the server
  useEffect(() => () => cancelRef.current?.(), []);

  const pickedUri = source?.kind === "device" ? source.file.uri : null;
  useEffect(() => {
    if (!pickedUri) return;
    return () => discardPicked(pickedUri);
  }, [pickedUri]);

  useEffect(() => {
    if (!fileId) return;
    let active = true;
    vaze.files.getById(fileId).then(({ data, error }) => {
      if (!active) return;
      setFinding(false);
      const file = data?.file as File | undefined;
      if (file) setSource({ kind: "vaze", file });
      else {
        setStatus({
          phase: "error",
          message: error?.message ?? "That video is no longer on the server",
        });
      }
    });
    return () => {
      active = false;
    };
  }, [fileId, vaze]);

  function options(): VideoConversionOptions {
    const sent: Record<string, string | number | boolean> = { format };
    if (!gif) sent.codec = codec;
    if (!copy) {
      if (fitToSize) {
        sent.targetSize = Math.round(Number(targetMb) * 1024 ** 2);
      } else {
        sent.quality = compression === "size" ? "balanced" : compression;
      }
      sent.resolution = resolution;
      sent.fps = fps;
    }
    if (!gif && !audio) sent.audio = false;
    if (start.trim()) sent.start = start.trim();
    if (end.trim()) sent.end = end.trim();
    // the checks above keep the pairs the server refuses apart
    return sent as VideoConversionOptions;
  }

  function convert(next: ConversionSource) {
    const run = ++runRef.current;
    const live = () => runRef.current === run;
    const update = (value: Status) => {
      if (live()) setStatus(value);
    };
    const finish = (final: Status) => {
      if (!live()) return;
      cancelRef.current = null;
      setStatus(final);
    };

    setStatus(
      next.kind === "device"
        ? { phase: "uploading", progress: 0 }
        : { phase: "starting" },
    );

    cancelRef.current = convertVideo(vaze, next, options(), {
      onUploadProgress: (progress) => update({ phase: "uploading", progress }),
      onStarting: () => update({ phase: "starting" }),
      onJob: (job) =>
        update(
          job.status === "queued"
            ? { phase: "queued", position: job.position ?? 0 }
            : { phase: "converting", progress: job.progress },
        ),
      onDownloadProgress: (progress) =>
        update({ phase: "downloading", progress }),
      onDone: (video, job) => finish({ phase: "done", video, job }),
      onError: (message) => finish({ phase: "error", message }),
    });
  }

  function cancel() {
    cancelRef.current?.();
    cancelRef.current = null;
    runRef.current++;
    setStatus(IDLE);
  }

  function choose(next: ConversionSource | null) {
    cancel();
    setSource(next);
  }

  // a result made with other options would no longer match them
  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      if (!busy) setStatus(IDLE);
    };
  }

  function changeFormat(next: VideoFormat) {
    const nextCodecs = VIDEO_FORMAT_INFO[next].codecs;
    if (nextCodecs.length > 0 && !nextCodecs.includes(codec)) {
      setCodec(nextCodecs[0]);
    }
    // GIFs are kept small unless asked otherwise, and can't be fitted to a size
    if (next === "gif" && !gif) {
      setResolution(String(GIF_RESOLUTION));
      setFps(String(GIF_FRAME_RATE));
      if (compression === "size") setCompression("balanced");
    } else if (next !== "gif" && gif) {
      setResolution(ORIGINAL);
      setFps(ORIGINAL);
    }
    setFormat(next);
  }

  async function pick(origin: SourceOrigin) {
    if (origin === "vaze") return setPicking(true);
    try {
      const picked = await pickOne("video", origin, { gifs: true });
      if (picked) choose({ kind: "device", file: picked });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't open your videos",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <ToolScroll description="Compress a video, or change its format, size or frame rate, trim it and mute it. HDR is tone mapped and details such as where it was filmed are left out. The result isn't kept on the server, so save or share it.">
      {finding ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : source ? (
        <SourceRow
          source={source}
          icon={Clapperboard}
          removeLabel="Remove the video"
          onRemove={busy ? undefined : () => choose(null)}
        />
      ) : (
        <SourceChoices
          icon={Clapperboard}
          title="Choose a video to get started"
          hint="MP4, MOV, MKV, WebM, AVI, GIF and more."
          descriptions={{
            media: "A video in your gallery",
            files: "A video or GIF saved on this phone",
            vaze: `A video or GIF on ${server.name}`,
          }}
          onPick={pick}
        />
      )}

      {source && !busy ? (
        <>
          <Option label="Format">
            <ChoiceTabs
              value={format}
              choices={VIDEO_FORMATS.map((value) => ({
                value,
                label: VIDEO_FORMAT_INFO[value].label,
              }))}
              onChange={change(changeFormat)}
            />
          </Option>

          <Option label="Codec">
            {gif ? (
              <Description>GIFs loop and have no sound.</Description>
            ) : (
              <>
                <ChoiceTabs
                  value={codec}
                  choices={codecs.map((value) => ({
                    value,
                    label: VIDEO_CODEC_INFO[value].label,
                  }))}
                  onChange={change(setCodec)}
                />
                <Description>{VIDEO_CODEC_INFO[codec].hint}.</Description>
              </>
            )}
          </Option>

          {copy ? null : (
            <>
              <Option label="Quality">
                <ChoiceTabs
                  value={compression}
                  choices={COMPRESSIONS.filter(
                    (choice) => !gif || choice.value !== "size",
                  )}
                  onChange={change(setCompression)}
                />
                {fitToSize ? (
                  <>
                    <Input
                      value={targetMb}
                      onChangeText={change(setTargetMb)}
                      keyboardType="decimal-pad"
                      accessibilityLabel="Size in MB"
                    />
                    <Description>
                      In MB. It takes two passes, so about twice as long.
                    </Description>
                  </>
                ) : null}
              </Option>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Option label="Resolution">
                    <ChoiceSelect
                      label="Resolution"
                      value={resolution}
                      choices={RESOLUTIONS}
                      onChange={change(setResolution)}
                    />
                  </Option>
                </View>
                <View className="flex-1">
                  <Option label="Frame rate">
                    <ChoiceSelect
                      label="Frame rate"
                      value={fps}
                      choices={FRAME_RATES}
                      onChange={change(setFps)}
                    />
                  </Option>
                </View>
              </View>
              <Description className="-mt-2">
                Never made larger, and a slower video keeps its own frame rate.
              </Description>
            </>
          )}

          {gif ? null : (
            <ControlField
              isSelected={audio}
              onSelectedChange={change(setAudio)}
              className="items-center gap-3"
            >
              <View className="flex-1 gap-1">
                <Label>Keep the sound</Label>
                <Description>Turn off for a silent video.</Description>
              </View>
              <ControlField.Indicator variant="switch" />
            </ControlField>
          )}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Option label="Start">
                <Input
                  value={start}
                  onChangeText={change(setStart)}
                  placeholder="0:00"
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                  accessibilityLabel="Start"
                />
              </Option>
            </View>
            <View className="flex-1">
              <Option label="End">
                <Input
                  value={end}
                  onChangeText={change(setEnd)}
                  placeholder="The end"
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                  accessibilityLabel="End"
                />
              </Option>
            </View>
          </View>

          {problem ? (
            <Text
              accessibilityRole="alert"
              className="font-normal text-sm text-danger"
            >
              {problem}
            </Text>
          ) : (
            <Description className="-mt-2">
              Trim it by seconds, or by minutes and seconds such as 1:30.
            </Description>
          )}
        </>
      ) : null}

      {status.phase !== "idle" ? <StatusPanel status={status} /> : null}

      {result ? (
        <ResultActions
          file={result.video}
          mimeType={VIDEO_FORMAT_INFO[result.job.format].mimeType}
          againLabel="Convert another video"
          onAgain={() => choose(null)}
        />
      ) : busy ? (
        <Button variant="secondary" onPress={cancel}>
          Cancel
        </Button>
      ) : source ? (
        <Button isDisabled={Boolean(problem)} onPress={() => convert(source)}>
          {status.phase === "error" ? "Try again" : `Convert to ${label}`}
        </Button>
      ) : null}

      <FilePickerSheet
        kind="convertible-video"
        isOpen={picking}
        onOpenChange={setPicking}
        onSelect={(file) => {
          setPicking(false);
          choose({ kind: "vaze", file });
        }}
      />
    </ToolScroll>
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
    case "queued":
      return (
        <ConversionProgress
          label={
            // nothing ahead, so it starts in a moment
            status.position === 0
              ? "Starting…"
              : `Waiting for ${status.position} ${status.position === 1 ? "video" : "videos"} ahead of it…`
          }
          progress={null}
        />
      );
    case "converting":
      return (
        <ConversionProgress
          label="Converting video…"
          progress={status.progress}
        />
      );
    case "downloading":
      return (
        <ConversionProgress
          label="Downloading video…"
          progress={status.progress}
        />
      );
    case "done": {
      const { job, video } = status;
      const size = video.size ?? job.size ?? 0;
      const kind =
        job.codec && job.codec !== "copy"
          ? `${VIDEO_FORMAT_INFO[job.format].label} · ${VIDEO_CODEC_INFO[job.codec].label}`
          : VIDEO_FORMAT_INFO[job.format].label;
      const details = [
        kind,
        `${job.width} × ${job.height}`,
        job.duration ? formatTimestamp(job.duration) : null,
        formatBytes(size),
        sizeChange(size, job.sourceSize),
      ];

      return (
        <ConversionReady
          title="Your video is ready"
          preview={
            <View className="size-10 items-center justify-center rounded-xl bg-success-soft">
              <Icon icon={Clapperboard} size={18} className="text-success" />
            </View>
          }
          name={video.name}
          details={details.filter(Boolean).join(" · ")}
        />
      );
    }
  }
}
