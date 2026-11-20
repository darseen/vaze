import type { File } from "@darseen/vaze";
import type { File as DeviceFile } from "expo-file-system";
import { Button, Spinner, useToast } from "heroui-native";
import { AudioLines, FileVideo } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { ToolScroll } from "@/components/tool-parts";
import { convertToAudio, type ConversionSource } from "@/lib/conversion";
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
  | { phase: "converting"; progress: number | null; received: number }
  | { phase: "done"; audio: DeviceFile }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };
const AUDIO_TYPE = "audio/mpeg";

/** Extracts a video's audio as an MP3. A stored video's `fileId` starts right away. */
export function VideoToAudio({ fileId }: { fileId?: string }) {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [finding, setFinding] = useState(Boolean(fileId));
  const [picking, setPicking] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  // events from a canceled run are ignored
  const runRef = useRef(0);

  const busy = status.phase === "uploading" || status.phase === "converting";
  const audio = status.phase === "done" ? status.audio : null;

  // leaving the screen cancels the request, which stops ffmpeg on the server
  useEffect(() => () => cancelRef.current?.(), []);

  const pickedUri = source?.kind === "device" ? source.file.uri : null;
  useEffect(() => {
    if (!pickedUri) return;
    return () => discardPicked(pickedUri);
  }, [pickedUri]);

  function start(next: ConversionSource) {
    const run = ++runRef.current;
    const live = () => runRef.current === run;
    const finish = (final: Status) => {
      if (!live()) return;
      cancelRef.current = null;
      setStatus(final);
    };

    setStatus(
      next.kind === "device"
        ? { phase: "uploading", progress: 0 }
        : { phase: "converting", progress: null, received: 0 },
    );

    cancelRef.current = convertToAudio(vaze, next, {
      onUploadProgress: (fraction) => {
        if (!live()) return;
        // once sent, the server reads the video before audio comes back
        setStatus(
          fraction < 1
            ? { phase: "uploading", progress: fraction }
            : { phase: "converting", progress: null, received: 0 },
        );
      },
      onProgress: (received, progress) => {
        if (live()) setStatus({ phase: "converting", progress, received });
      },
      onDone: (result) => finish({ phase: "done", audio: result }),
      onError: (message) => finish({ phase: "error", message }),
    });
  }

  useEffect(() => {
    if (!fileId) return;
    let active = true;
    vaze.files.getById(fileId).then(({ data, error }) => {
      if (!active) return;
      setFinding(false);
      const file = data?.file as File | undefined;
      if (!file) {
        setStatus({
          phase: "error",
          message: error?.message ?? "That video is no longer on the server",
        });
        return;
      }
      const next = { kind: "vaze", file } as const;
      setSource(next);
      start(next);
    });
    return () => {
      active = false;
    };
  }, [fileId, vaze]);

  function choose(next: ConversionSource | null) {
    cancel();
    setSource(next);
  }

  function cancel() {
    cancelRef.current?.();
    cancelRef.current = null;
    runRef.current++;
    setStatus(IDLE);
  }

  async function pick(origin: SourceOrigin) {
    if (origin === "vaze") return setPicking(true);
    try {
      const picked = await pickOne("video", origin);
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
    <ToolScroll description="Extract the sound of a video as an MP3, from MP4, MOV, MKV, WebM, AVI and more. The MP3 isn't kept on the server, so save or share it.">
      {finding ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : source ? (
        <SourceRow
          source={source}
          icon={FileVideo}
          removeLabel="Remove the video"
          onRemove={busy ? undefined : () => choose(null)}
        />
      ) : (
        <SourceChoices
          icon={FileVideo}
          title="Choose a video to get started"
          hint="Its audio comes back as an MP3."
          descriptions={{
            media: "A video in your gallery",
            files: "A video saved on this phone",
            vaze: `A video on ${server.name}`,
          }}
          onPick={pick}
        />
      )}

      {status.phase !== "idle" ? <StatusPanel status={status} /> : null}

      {audio ? (
        <ResultActions
          file={audio}
          mimeType={AUDIO_TYPE}
          againLabel="Convert another video"
          onAgain={() => choose(null)}
        />
      ) : busy ? (
        <Button variant="secondary" onPress={cancel}>
          Cancel
        </Button>
      ) : source ? (
        <Button onPress={() => start(source)}>
          {status.phase === "error" ? "Try again" : "Convert to audio"}
        </Button>
      ) : null}

      <FilePickerSheet
        kind="video"
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
  if (status.phase === "error") {
    return <ConversionFailed message={status.message} />;
  }

  if (status.phase === "done") {
    return (
      <ConversionReady
        title="Your audio is ready"
        preview={
          <View className="size-10 items-center justify-center rounded-xl bg-success-soft">
            <Icon icon={AudioLines} size={18} className="text-success" />
          </View>
        }
        name={status.audio.name}
        details={`MP3 audio · ${formatBytes(status.audio.size ?? 0)}`}
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
