import type { File, Folder } from "@darseen/vaze";
import * as Haptics from "expo-haptics";
import { ChevronRight, Folder as FolderIcon, Lock } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { formatBytes, timeAgo } from "@/lib/format";
import { Icon } from "../icon";
import { FileThumb } from "./file-thumb";

export type Entry =
  { type: "file"; file: File } | { type: "folder"; folder: Folder };

type EntryRowProps = {
  entry: Entry;
  onPress: () => void;
  onLongPress: () => void;
};

export function EntryRow({ entry, onPress, onLongPress }: EntryRowProps) {
  const name = entry.type === "file" ? entry.file.name : entry.folder.name;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        Haptics.selectionAsync();
        onLongPress();
      }}
      className="flex-row items-center gap-3 px-5 py-2.5 active:bg-default"
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      {entry.type === "file" ? (
        <FileThumb file={entry.file} />
      ) : (
        <View className="size-10 items-center justify-center rounded-xl bg-accent-soft">
          <Icon icon={FolderIcon} className="text-accent-soft-foreground" />
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

      {entry.type === "folder" ? (
        <Icon icon={ChevronRight} size={18} className="text-muted" />
      ) : null}
    </Pressable>
  );
}
