import type { File, Folder } from "@darseen/vaze";
import * as Haptics from "expo-haptics";
import {
  Check,
  ChevronRight,
  EllipsisVertical,
  Folder as FolderIcon,
  Lock,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { formatBytes, timeAgo } from "@/lib/format";
import { Icon } from "../icon";
import { FileThumb } from "./file-thumb";

export type Entry =
  { type: "file"; file: File } | { type: "folder"; folder: Folder };

/** The round check a file shows while files are being selected. */
export function SelectMark({ selected }: { selected: boolean }) {
  // two fixed views, since toggling classes on list items loses their children
  return selected ? (
    <View className="size-6 items-center justify-center rounded-full border-2 border-accent bg-accent">
      <Icon
        icon={Check}
        size={14}
        strokeWidth={3}
        className="text-accent-foreground"
      />
    </View>
  ) : (
    <View className="size-6 rounded-full border-2 border-muted bg-background/80" />
  );
}

type EntryRowProps = {
  entry: Entry;
  onPress: () => void;
  onLongPress: () => void;
  onOptions: () => void;
  /** Files are being selected, so files show a check and folders dim. */
  selecting?: boolean;
  selected?: boolean;
};

export function EntryRow({
  entry,
  onPress,
  onLongPress,
  onOptions,
  selecting = false,
  selected = false,
}: EntryRowProps) {
  const name = entry.type === "file" ? entry.file.name : entry.folder.name;
  const checkable = selecting && entry.type === "file";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        Haptics.selectionAsync();
        onLongPress();
      }}
      style={{ opacity: selecting && !checkable ? 0.4 : 1 }}
      className="flex-row items-center gap-3 px-5 py-2.5 active:bg-default"
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={checkable ? { selected } : undefined}
    >
      {selected ? (
        <View pointerEvents="none" className="absolute inset-0 bg-default" />
      ) : null}
      {entry.type === "file" ? (
        <FileThumb file={entry.file} />
      ) : (
        <View className="size-10 items-center justify-center rounded-xl bg-folder-soft">
          <Icon icon={FolderIcon} filled className="text-folder" />
        </View>
      )}

      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className="font-normal text-base text-foreground"
        >
          {name}
        </Text>
        {entry.type === "file" ? (
          <View className="flex-row items-center gap-1.5">
            {entry.file.visibility === "private" ? (
              <Icon icon={Lock} size={12} className="text-muted" />
            ) : null}
            <Text numberOfLines={1} className="font-normal text-sm text-muted">
              {formatBytes(entry.file.size)} · {timeAgo(entry.file.createdAt)}
            </Text>
          </View>
        ) : null}
      </View>

      {checkable ? (
        <SelectMark selected={selected} />
      ) : entry.type === "folder" ? (
        <Icon icon={ChevronRight} size={18} className="text-muted" />
      ) : (
        <Pressable
          onPress={onOptions}
          hitSlop={8}
          className="-mr-2 size-9 items-center justify-center rounded-xl active:bg-default"
          accessibilityLabel={`${name} options`}
        >
          <Icon icon={EllipsisVertical} size={18} className="text-muted" />
        </Pressable>
      )}
    </Pressable>
  );
}
