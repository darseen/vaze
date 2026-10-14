import * as Haptics from "expo-haptics";
import { cn } from "heroui-native";
import {
  EllipsisVertical,
  Folder as FolderIcon,
  Lock,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { formatBytes, timeAgo } from "@/lib/format";
import { Icon } from "../icon";
import type { Entry } from "./entry-row";
import { FileThumb } from "./file-thumb";

type EntryCardProps = {
  entry: Entry;
  width: number;
  onPress: () => void;
  onOptions: () => void;
};

export function EntryCard({
  entry,
  width,
  onPress,
  onOptions,
}: EntryCardProps) {
  const isFile = entry.type === "file";
  const name = isFile ? entry.file.name : entry.folder.name;
  const createdAt = isFile ? entry.file.createdAt : entry.folder.createdAt;
  const previewHeight = Math.round(width * 0.72);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        Haptics.selectionAsync();
        onOptions();
      }}
      style={{ width }}
      className="overflow-hidden rounded-3xl border border-border bg-surface active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View
        style={{ height: previewHeight }}
        className={cn(
          "items-center justify-center",
          isFile ? "bg-default-soft" : "bg-folder-soft",
        )}
      >
        {isFile ? (
          <FileThumb
            file={entry.file}
            size={previewHeight}
            wide
            className="rounded-none bg-transparent"
          />
        ) : (
          <Icon icon={FolderIcon} size={44} filled className="text-folder" />
        )}

        {isFile && entry.file.visibility === "private" ? (
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded-lg border border-border bg-background/80 px-1.5 py-0.5">
            <Icon icon={Lock} size={11} className="text-muted" />
            <Text className="text-xs font-medium text-muted">Private</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onOptions}
          hitSlop={8}
          className="absolute top-2 right-2 size-8 items-center justify-center rounded-xl border border-border bg-background/80 active:bg-default"
          accessibilityLabel={`${name} options`}
        >
          <Icon icon={EllipsisVertical} size={16} />
        </Pressable>
      </View>

      <View className="gap-1 px-3 py-2.5">
        <Text
          numberOfLines={1}
          className="text-sm font-semibold text-foreground"
        >
          {name}
        </Text>
        <View className="flex-row items-center justify-between gap-2">
          <Text
            numberOfLines={1}
            className="shrink text-xs font-medium text-muted"
          >
            {isFile ? formatBytes(entry.file.size) : "Folder"}
          </Text>
          <Text numberOfLines={1} className="text-xs font-medium text-muted">
            {timeAgo(createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
