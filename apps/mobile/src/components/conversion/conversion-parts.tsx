import type { File as DeviceFile } from "expo-file-system";
import { Image } from "expo-image";
import { Button, Spinner, useToast } from "heroui-native";
import {
  Check,
  CircleAlert,
  Cloud,
  Download,
  FolderOpen,
  Images,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ActionGroup } from "@/components/action-group";
import { FileThumb } from "@/components/files/file-thumb";
import { UploadProgress } from "@/components/files/uploads-sheet";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import type { ConversionSource } from "@/lib/conversion";
import { formatBytes } from "@/lib/format";
import {
  canSaveToDownloads,
  saveLocalFile,
  shareLocalFile,
} from "@/lib/transfer";

export type SourceOrigin = "media" | "files" | "vaze";

/** Where a file can come from, before one is chosen. */
export function SourceChoices({
  icon,
  title,
  hint,
  descriptions,
  onPick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  descriptions: Record<SourceOrigin, string>;
  onPick: (origin: SourceOrigin) => void;
}) {
  return (
    <>
      <View className="items-center gap-2 pt-2">
        <View className="size-14 items-center justify-center rounded-2xl bg-default">
          <Icon icon={icon} size={26} />
        </View>
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="font-normal text-center text-sm text-muted">
          {hint}
        </Text>
      </View>
      <ActionGroup
        actions={[
          {
            label: "From Photos",
            icon: Images,
            description: descriptions.media,
            onPress: () => onPick("media"),
          },
          {
            label: "From Files",
            icon: FolderOpen,
            description: descriptions.files,
            onPress: () => onPick("files"),
          },
          {
            label: "From Vaze",
            icon: Cloud,
            description: descriptions.vaze,
            onPress: () => onPick("vaze"),
          },
        ]}
      />
    </>
  );
}

export function SourceRow({
  source,
  icon,
  showDeviceImage = false,
  removeLabel,
  onRemove,
}: {
  source: ConversionSource;
  /** Stands in for a file from the phone, which has no server thumbnail. */
  icon: LucideIcon;
  /** Shows a picked image itself rather than the icon. */
  showDeviceImage?: boolean;
  removeLabel: string;
  /** Missing while the file is converting. */
  onRemove?: () => void;
}) {
  const { server } = useServer();

  return (
    <View className="flex-row items-center gap-3">
      {source.kind === "vaze" ? (
        <FileThumb file={source.file} size={44} />
      ) : (
        <View className="size-11 items-center justify-center overflow-hidden rounded-xl bg-default">
          <Icon icon={icon} className="text-muted" />
          {showDeviceImage ? (
            <Image
              source={{ uri: source.file.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          ) : null}
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
          {source.kind === "device" ? "This phone" : server.name}
        </Text>
      </View>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          className="size-8 items-center justify-center rounded-xl active:bg-default"
          accessibilityLabel={removeLabel}
        >
          <Icon icon={X} size={18} className="text-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ConversionFailed({ message }: { message: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-2xl border border-border p-3"
    >
      <Icon icon={CircleAlert} size={18} className="text-danger" />
      <Text className="font-normal flex-1 text-sm text-danger">{message}</Text>
    </View>
  );
}

/** `progress` is a fraction, or null to show `received` bytes instead. */
export function ConversionProgress({
  label,
  progress,
  received = 0,
}: {
  label: string;
  progress: number | null;
  received?: number;
}) {
  const percent = progress === null ? null : Math.round(progress * 100);
  const detail =
    percent !== null
      ? `${percent}%`
      : received > 0
        ? formatBytes(received)
        : null;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={
        percent !== null ? { now: percent, min: 0, max: 100 } : undefined
      }
      className="gap-3 rounded-2xl border border-border p-3"
    >
      <View className="flex-row items-center gap-2">
        <Spinner size="sm" />
        <Text className="flex-1 text-sm font-medium text-foreground">
          {label}
        </Text>
        {detail ? (
          <Text className="font-normal text-sm text-muted tabular-nums">
            {detail}
          </Text>
        ) : null}
      </View>
      {percent !== null ? <UploadProgress value={percent} /> : null}
    </View>
  );
}

export function ConversionReady({
  title,
  preview,
  name,
  details,
}: {
  title: string;
  preview: ReactNode;
  name: string;
  details: string;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border p-3">
      <View className="flex-row items-center gap-2">
        <Icon icon={Check} size={16} className="text-success" />
        <Text className="text-sm font-medium text-foreground">{title}</Text>
      </View>
      <View className="flex-row items-center gap-3">
        {preview}
        <View className="flex-1 gap-0.5">
          <Text
            numberOfLines={1}
            className="font-medium text-sm text-foreground"
          >
            {name}
          </Text>
          <Text className="font-normal text-xs text-muted">{details}</Text>
        </View>
      </View>
    </View>
  );
}

/** Saves or shares a finished file, or starts over with another. */
export function ResultActions({
  file,
  mimeType,
  againLabel,
  onAgain,
}: {
  file: DeviceFile;
  mimeType: string;
  againLabel: string;
  onAgain: () => void;
}) {
  const { toast } = useToast();
  const [handing, setHanding] = useState<"save" | "share" | null>(null);

  async function handOff(action: "save" | "share") {
    setHanding(action);
    try {
      if (action === "share") {
        await shareLocalFile(file, mimeType);
      } else {
        const saved = await saveLocalFile(file, mimeType);
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
    <View className="gap-2">
      {canSaveToDownloads ? (
        <Button onPress={() => handOff("save")} isDisabled={handing !== null}>
          <Icon icon={Download} size={18} className="text-accent-foreground" />
          <Button.Label>Save to Downloads</Button.Label>
        </Button>
      ) : null}
      <Button
        variant={canSaveToDownloads ? "secondary" : "primary"}
        onPress={() => handOff("share")}
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
      <Button variant="ghost" onPress={onAgain}>
        {againLabel}
      </Button>
    </View>
  );
}
