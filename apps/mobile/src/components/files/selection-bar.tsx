import type { File } from "@darseen/vaze";
import { Spinner, Surface, useToast } from "heroui-native";
import {
  Download,
  FolderInput,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useDownload } from "@/hooks/use-download";
import { fileDownload } from "@/lib/transfer";
import { useLibrary } from "@/stores/library";
import { ConfirmSheet } from "../confirm-sheet";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { SHEET_CLOSE_MS } from "../sheet";
import { MoveSheet } from "./move-sheet";

const fileWord = (count: number) => (count === 1 ? "file" : "files");

function BarButton({
  icon,
  label,
  busy = false,
  danger = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  busy?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="flex-1 items-center gap-1 rounded-2xl py-2 active:bg-default"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <Spinner size="sm" />
      ) : (
        <Icon
          icon={icon}
          size={20}
          className={danger ? "text-danger" : "text-foreground"}
        />
      )}
      <Text
        className={
          danger
            ? "text-xs font-medium text-danger"
            : "text-xs font-medium text-foreground"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

type SelectionBarProps = {
  /** The selected files, all in `folderKey`. */
  files: File[];
  folderKey: string;
  /** Ends selecting once the files have moved or gone. */
  onDone: () => void;
};

/** What can be done with several selected files, like the web's bulk toolbar. */
export function SelectionBar({ files, folderKey, onDone }: SelectionBarProps) {
  const { server, vaze, can } = useServer();
  const { toast } = useToast();
  const { download, busy } = useDownload();
  const loadFolder = useLibrary((state) => state.loadFolder);
  const loadStats = useLibrary((state) => state.loadStats);
  const [sheet, setSheet] = useState<"move" | "delete" | null>(null);

  const count = files.length;
  const ids = files.map((file) => file.id);

  const refresh = (...keys: string[]) => {
    for (const key of new Set(keys)) loadFolder(server.id, vaze, key);
    loadStats(server.id, vaze);
  };

  const notifyAfterClose = (
    variant: "success" | "warning" | "danger",
    label: string,
    description?: string,
  ) => {
    setTimeout(
      () => toast.show({ variant, label, description }),
      SHEET_CLOSE_MS,
    );
  };

  function downloadSelected() {
    // one file downloads as itself and several as one zip, like the web
    download(
      count === 1
        ? fileDownload(vaze, files[0])
        : {
            url: vaze.files.downloadManyUrl(),
            body: { ids },
            name: `${folderKey.split("/").pop() || "files"}.zip`,
            mimeType: "application/zip",
          },
    );
  }

  async function move(destination: string) {
    const { data, error } = await vaze.files.moveMany(ids, {
      folder: destination,
    });
    if (error || !data) return error?.message ?? "Couldn't move the files";

    refresh(folderKey, destination);
    if (data.failed.length > 0) {
      notifyAfterClose(
        "warning",
        `Moved ${data.files.length} of ${count} ${fileWord(count)}`,
        `${data.failed.length} couldn't be moved`,
      );
    } else {
      notifyAfterClose(
        "success",
        `Moved ${count} ${fileWord(count)} to ${destination.split("/").pop() || "All files"}`,
      );
    }
    setTimeout(onDone, SHEET_CLOSE_MS);
    return null;
  }

  async function remove() {
    const { data, error } = await vaze.files.deleteMany(ids);
    if (error || !data) {
      return notifyAfterClose("danger", "Couldn't delete", error?.message);
    }

    refresh(folderKey);
    if (data.failed.length > 0) {
      notifyAfterClose(
        "warning",
        `Deleted ${data.deleted.length} of ${count} ${fileWord(count)}`,
        `${data.failed.length} couldn't be deleted`,
      );
    } else {
      notifyAfterClose(
        "success",
        `Deleted ${data.deleted.length} ${fileWord(data.deleted.length)}`,
      );
    }
    setTimeout(onDone, SHEET_CLOSE_MS);
  }

  return (
    <>
      {/* stays mounted while nothing is selected, so its sheets can finish closing */}
      {count > 0 ? (
        <View className="absolute inset-x-0 bottom-0 px-5 pb-3">
          <Surface
            variant="secondary"
            className="flex-row gap-1 rounded-3xl border border-border p-1.5"
          >
            <BarButton
              icon={Download}
              label="Download"
              busy={busy}
              onPress={downloadSelected}
            />
            {can("files:write") ? (
              <BarButton
                icon={FolderInput}
                label="Move"
                onPress={() => setSheet("move")}
              />
            ) : null}
            {can("files:delete") ? (
              <BarButton
                icon={Trash2}
                label="Delete"
                danger
                onPress={() => setSheet("delete")}
              />
            ) : null}
          </Surface>
        </View>
      ) : null}

      <MoveSheet
        entries={files.map((file) => ({ type: "file", file }))}
        isOpen={sheet === "move"}
        onOpenChange={(open) => !open && setSheet(null)}
        onMove={move}
      />
      <ConfirmSheet
        isOpen={sheet === "delete"}
        onOpenChange={(open) => !open && setSheet(null)}
        title={`Delete ${count} ${fileWord(count)}?`}
        description="They're removed from the server for good. This can't be undone."
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </>
  );
}
