import type { File } from "@darseen/vaze";
import type { File as DeviceFile } from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import { Button, Card, Spinner, useToast } from "heroui-native";
import {
  AudioLines,
  Check,
  CircleAlert,
  Cloud,
  Download,
  FileVideo,
  FolderOpen,
  Images,
  Share2,
  X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ActionGroup } from "@/components/action-group";
import { VideoPickerSheet } from "@/components/conversion/video-picker-sheet";
import { FileThumb } from "@/components/files/file-thumb";
import { UploadProgress } from "@/components/files/uploads-sheet";
import { Icon } from "@/components/icon";
import { ListSection } from "@/components/list-section";
import { useServer } from "@/components/server-context";
import {
  clearConversions,
  convertToAudio,
  type ConversionSource,
} from "@/lib/conversion";
import { formatBytes } from "@/lib/format";
import {
  canSaveToDownloads,
  discardPicked,
  pickVideo,
  saveLocalFile,
  shareLocalFile,
} from "@/lib/transfer";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "converting"; progress: number | null; received: number }
  | { phase: "done"; audio: DeviceFile }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };
const AUDIO_TYPE = "audio/mpeg";

export default function ConversionScreen() {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  // set by a video's Convert to audio action, which starts right away
  const { file: fileId } = useLocalSearchParams<{ file?: string }>();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [finding, setFinding] = useState(Boolean(fileId));
  const [picking, setPicking] = useState(false);
  const [handing, setHanding] = useState<"save" | "share" | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  // events from a canceled run are ignored
  const runRef = useRef(0);

  const busy = status.phase === "uploading" || status.phase === "converting";
  const audio = status.phase === "done" ? status.audio : null;

  // leaving the screen cancels the request, which stops ffmpeg on the server
  useEffect(() => {
    clearConversions();
    return () => cancelRef.current?.();
  }, []);

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

  async function pickFromDevice(from: "media" | "files") {
    try {
      const picked = await pickVideo(from);
      if (picked) choose({ kind: "device", file: picked });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't open your videos",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function handOff(action: "save" | "share", file: DeviceFile) {
    setHanding(action);
    try {
      if (action === "share") {
        await shareLocalFile(file, AUDIO_TYPE);
      } else {
        const saved = await saveLocalFile(file, AUDIO_TYPE);
        if (saved) {
          toast.show({
            variant: "success",
            label: "Saved to Downloads",
            description: saved,
          });
        }
      }
    } catch (error) {
      toast.show({
        variant: "danger",
        label: action === "share" ? "Couldn't share it" : "Couldn't save it",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setHanding(null);
    }
  }

  return (
    <>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pt-3 pb-8"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text className="font-normal text-sm text-muted">
          Convert files from one format to another.
        </Text>

        <ListSection
          title="Video to audio"
          footer="MP4, MOV, MKV, WebM, AVI and more. The MP3 isn't kept on the server, so save or share it."
        >
          <Card className="gap-4 border border-border">
            {finding ? (
              <View className="items-center py-8">
                <Spinner />
              </View>
            ) : source ? (
              <SourceRow
                source={source}
                serverName={server.name}
                onRemove={busy ? undefined : () => choose(null)}
              />
            ) : (
              <>
                <View className="items-center gap-2 pt-2">
                  <View className="size-14 items-center justify-center rounded-2xl bg-default">
                    <Icon icon={FileVideo} size={26} />
                  </View>
                  <Text className="text-lg font-semibold text-foreground">
                    Choose a video to get started
                  </Text>
                  <Text className="font-normal text-center text-sm text-muted">
                    Its audio comes back as an MP3.
                  </Text>
                </View>
                <ActionGroup
                  actions={[
                    {
                      label: "From Photos",
                      icon: Images,
                      description: "A video in your gallery",
                      onPress: () => pickFromDevice("media"),
                    },
                    {
                      label: "From Files",
                      icon: FolderOpen,
                      description: "A video saved on this phone",
                      onPress: () => pickFromDevice("files"),
                    },
                    {
                      label: "From Vaze",
                      icon: Cloud,
                      description: `A video on ${server.name}`,
                      onPress: () => setPicking(true),
                    },
                  ]}
                />
              </>
            )}

            {status.phase !== "idle" ? <StatusPanel status={status} /> : null}

            {audio ? (
              <View className="gap-2">
                {canSaveToDownloads ? (
                  <Button
                    onPress={() => handOff("save", audio)}
                    isDisabled={handing !== null}
                  >
                    <Icon
                      icon={Download}
                      size={18}
                      className="text-accent-foreground"
                    />
                    <Button.Label>Save to Downloads</Button.Label>
                  </Button>
                ) : null}
                <Button
                  variant={canSaveToDownloads ? "secondary" : "primary"}
                  onPress={() => handOff("share", audio)}
                  isDisabled={handing !== null}
                >
                  <Icon
                    icon={Share2}
                    size={18}
                    className={
                      canSaveToDownloads
                        ? "text-default-foreground"
                        : "text-accent-foreground"
                    }
                  />
                  <Button.Label>Share</Button.Label>
                </Button>
                <Button variant="ghost" onPress={() => choose(null)}>
                  Convert another video
                </Button>
              </View>
            ) : busy ? (
              <Button variant="secondary" onPress={cancel}>
                Cancel
              </Button>
            ) : source ? (
              <Button onPress={() => start(source)}>
                {status.phase === "error" ? "Try again" : "Convert to audio"}
              </Button>
            ) : null}
          </Card>
        </ListSection>
      </ScrollView>

      <VideoPickerSheet
        isOpen={picking}
        onOpenChange={setPicking}
        onSelect={(file) => {
          setPicking(false);
          choose({ kind: "vaze", file });
        }}
      />
    </>
  );
}

function SourceRow({
  source,
  serverName,
  onRemove,
}: {
  source: ConversionSource;
  serverName: string;
  /** Missing while the video is converting. */
  onRemove?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      {source.kind === "vaze" ? (
        <FileThumb file={source.file} size={44} />
      ) : (
        <View className="size-11 items-center justify-center rounded-xl bg-default">
          <Icon icon={FileVideo} className="text-muted" />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className="font-medium text-base text-foreground"
        >
          {source.file.name}
        </Text>
        <Text numberOfLines={1} className="font-normal text-sm text-muted">
          {formatBytes(source.file.size)} ·{" "}
          {source.kind === "device" ? "This phone" : serverName}
        </Text>
      </View>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          className="size-8 items-center justify-center rounded-xl active:bg-default"
          accessibilityLabel="Remove the video"
        >
          <Icon icon={X} size={18} className="text-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusPanel({
  status,
}: {
  status: Exclude<Status, { phase: "idle" }>;
}) {
  if (status.phase === "error") {
    return (
      <View
        accessibilityRole="alert"
        className="flex-row items-start gap-2 rounded-2xl border border-border p-3"
      >
        <Icon icon={CircleAlert} size={18} className="text-danger" />
        <Text className="font-normal flex-1 text-sm text-danger">
          {status.message}
        </Text>
      </View>
    );
  }

  if (status.phase === "done") {
    return (
      <View className="gap-3 rounded-2xl border border-border p-3">
        <View className="flex-row items-center gap-2">
          <Icon icon={Check} size={16} className="text-success" />
          <Text className="text-sm font-medium text-foreground">
            Your audio is ready
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-xl bg-success-soft">
            <Icon icon={AudioLines} size={18} className="text-success" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text
              numberOfLines={1}
              className="font-medium text-sm text-foreground"
            >
              {status.audio.name}
            </Text>
            <Text className="font-normal text-xs text-muted">
              MP3 audio · {formatBytes(status.audio.size ?? 0)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const progress =
    status.progress === null ? null : Math.round(status.progress * 100);
  const detail =
    progress !== null
      ? `${progress}%`
      : status.phase === "converting" && status.received > 0
        ? formatBytes(status.received)
        : null;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={
        progress !== null ? { now: progress, min: 0, max: 100 } : undefined
      }
      className="gap-3 rounded-2xl border border-border p-3"
    >
      <View className="flex-row items-center gap-2">
        <Spinner size="sm" />
        <Text className="flex-1 text-sm font-medium text-foreground">
          {status.phase === "uploading"
            ? "Uploading video…"
            : "Extracting audio…"}
        </Text>
        {detail ? (
          <Text className="font-normal text-sm text-muted tabular-nums">
            {detail}
          </Text>
        ) : null}
      </View>
      {progress !== null ? <UploadProgress value={progress} /> : null}
    </View>
  );
}
