import { Chip } from "heroui-native";
import {
  Download,
  FolderInput,
  Globe,
  Link,
  Lock,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react-native";
import { Text, View } from "react-native";
import { fileKind, KIND_INFO, previewKind } from "@/lib/file-kind";
import { formatBytes, formatDateTime } from "@/lib/format";
import { ActionGroup } from "../action-group";
import { useServer } from "../server-context";
import { Sheet } from "../sheet";
import type { Entry } from "./entry-row";
import { FileThumb } from "./file-thumb";

export type EntryAction =
  | "download"
  | "share"
  | "copy-link"
  | "rename"
  | "move"
  | "make-private"
  | "make-public"
  | "delete";

type EntrySheetProps = {
  entry: Entry | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: EntryAction) => void;
  busy: EntryAction | null;
  error: string | null;
};

export function EntrySheet({
  entry,
  isOpen,
  onOpenChange,
  onAction,
  busy,
  error,
}: EntrySheetProps) {
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange}>
      {entry ? (
        <EntryActions
          entry={entry}
          onAction={onAction}
          busy={busy}
          error={error}
        />
      ) : null}
    </Sheet>
  );
}

function EntryActions({
  entry,
  onAction,
  busy,
  error,
}: Pick<EntrySheetProps, "onAction" | "busy" | "error"> & { entry: Entry }) {
  const { can } = useServer();
  const isFile = entry.type === "file";
  const canWrite = can("files:write");
  const isPrivate = isFile && entry.file.visibility === "private";

  return (
    <View className="gap-5">
      {isFile ? <FileDetails entry={entry} /> : <FolderDetails entry={entry} />}

      {error ? (
        <Text className="font-normal text-sm text-danger">{error}</Text>
      ) : null}

      <ActionGroup
        actions={[
          {
            label: "Download",
            icon: Download,
            description: isFile ? undefined : "Everything inside, as a zip",
            busy: busy === "download",
            onPress: () => onAction("download"),
          },
          {
            label: "Share",
            icon: Share2,
            hidden: !isFile,
            busy: busy === "share",
            onPress: () => onAction("share"),
          },
          {
            label: "Copy link",
            icon: Link,
            hidden: !isFile,
            description: isPrivate
              ? "A signed link that expires in an hour"
              : undefined,
            busy: busy === "copy-link",
            onPress: () => onAction("copy-link"),
          },
        ]}
      />

      <ActionGroup
        actions={[
          {
            label: "Rename",
            icon: Pencil,
            hidden: !canWrite,
            onPress: () => onAction("rename"),
          },
          {
            label: "Move",
            icon: FolderInput,
            hidden: !canWrite,
            onPress: () => onAction("move"),
          },
          {
            label: isFile ? "Make private" : "Make everything private",
            icon: Lock,
            hidden: !canWrite || (isFile && isPrivate),
            busy: busy === "make-private",
            onPress: () => onAction("make-private"),
          },
          {
            label: isFile ? "Make public" : "Make everything public",
            icon: Globe,
            hidden: !canWrite || (isFile && !isPrivate),
            busy: busy === "make-public",
            onPress: () => onAction("make-public"),
          },
        ]}
      />

      <ActionGroup
        actions={[
          {
            label: "Delete",
            icon: Trash2,
            danger: true,
            hidden: !can("files:delete"),
            onPress: () => onAction("delete"),
          },
        ]}
      />
    </View>
  );
}

function FileDetails({ entry }: { entry: Extract<Entry, { type: "file" }> }) {
  const { file } = entry;
  const kind = fileKind(file.name, file.mimeType);
  const preview = previewKind(file);
  // the kinds with something to look at get the big preview
  const wide = preview === "image" || preview === "video" || preview === "pdf";

  return (
    <View className="gap-4">
      {wide ? <FileThumb file={file} size={180} wide /> : null}
      <View className="flex-row items-start gap-3">
        {wide ? null : <FileThumb file={file} size={48} />}
        <View className="flex-1 gap-1">
          <Text
            numberOfLines={2}
            className="text-lg font-medium text-foreground"
          >
            {file.name}
          </Text>
          <Text className="font-normal text-sm text-muted">
            {formatBytes(file.size)} · {KIND_INFO[kind].noun} ·{" "}
            {formatDateTime(file.createdAt)}
          </Text>
        </View>
        <Chip
          size="sm"
          variant="soft"
          color={file.visibility === "private" ? "warning" : "default"}
        >
          <Chip.Label>
            {file.visibility === "private" ? "Private" : "Public"}
          </Chip.Label>
        </Chip>
      </View>
    </View>
  );
}

function FolderDetails({
  entry,
}: {
  entry: Extract<Entry, { type: "folder" }>;
}) {
  return (
    <View className="gap-1">
      <Text numberOfLines={2} className="text-lg font-medium text-foreground">
        {entry.folder.name}
      </Text>
      <Text numberOfLines={1} className="font-normal text-sm text-muted">
        /{entry.folder.key}
      </Text>
    </View>
  );
}
