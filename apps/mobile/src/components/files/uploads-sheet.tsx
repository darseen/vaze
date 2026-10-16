import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Button, Separator, Spinner, Surface } from "heroui-native";
import { CircleCheck, CircleSlash, CircleX, X } from "lucide-react-native";
import { Fragment } from "react";
import { Pressable, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { formatBytes } from "@/lib/format";
import { isRunning, useUploads, type Upload } from "@/stores/uploads";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { Sheet } from "../sheet";

// progress re-renders only what reads it, never the folder's whole grid
function useFolderUploads(folderKey: string) {
  const { server } = useServer();
  return useUploads(
    useShallow((state) =>
      state.uploads.filter(
        (upload) =>
          upload.serverId === server.id && upload.folderKey === folderKey,
      ),
    ),
  );
}

export function UploadProgress({ value }: { value: number }) {
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-default">
      <View
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.max(value, 2)}%` }}
      />
    </View>
  );
}

function statusText(upload: Upload) {
  switch (upload.status) {
    case "queued":
      return "Waiting";
    case "uploading":
      // the body is all sent before the server has stored the file
      return upload.progress === 100 ? "Finishing" : `${upload.progress}%`;
    case "done":
      return "Uploaded";
    case "canceled":
      return "Canceled";
    case "failed":
      return upload.error ?? "Failed";
  }
}

function StatusIcon({ upload }: { upload: Upload }) {
  if (upload.status === "done")
    return <Icon icon={CircleCheck} size={18} className="text-success" />;
  if (upload.status === "failed")
    return <Icon icon={CircleX} size={18} className="text-danger" />;
  if (upload.status === "canceled")
    return <Icon icon={CircleSlash} size={18} className="text-muted" />;
  return <Spinner size="sm" />;
}

function UploadRow({ upload }: { upload: Upload }) {
  const cancel = useUploads((state) => state.cancel);
  const running = isRunning(upload);

  return (
    <View className="gap-2 py-3">
      <View className="flex-row items-center gap-3">
        <StatusIcon upload={upload} />
        <View className="flex-1 gap-0.5">
          <Text
            numberOfLines={1}
            className="font-normal text-sm text-foreground"
          >
            {upload.name}
          </Text>
          <Text
            numberOfLines={2}
            className={
              upload.status === "failed"
                ? "font-normal text-xs text-danger"
                : "font-normal text-xs text-muted"
            }
          >
            {statusText(upload)} · {formatBytes(upload.size)}
          </Text>
        </View>
        {running ? (
          <Pressable
            onPress={() => cancel(upload.id)}
            hitSlop={8}
            className="size-8 items-center justify-center rounded-xl active:bg-default"
            accessibilityLabel={`Cancel ${upload.name}`}
          >
            <Icon icon={X} size={16} className="text-muted" />
          </Pressable>
        ) : null}
      </View>
      {upload.status === "uploading" ? (
        <UploadProgress value={upload.progress} />
      ) : null}
    </View>
  );
}

/** The running upload and its progress, above a folder's files. */
export function UploadBanner({
  folderKey,
  onOpen,
}: {
  folderKey: string;
  onOpen: () => void;
}) {
  const uploads = useFolderUploads(folderKey);
  const cancel = useUploads((state) => state.cancel);
  const current =
    uploads.find((upload) => upload.status === "uploading") ??
    uploads.find((upload) => upload.status === "queued");
  if (!current) return null;
  const finished = uploads.filter((upload) => !isRunning(upload)).length;

  return (
    <Pressable
      onPress={onOpen}
      className="mx-5 mt-3 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel="Show uploads"
    >
      <Surface variant="secondary" className="gap-3 rounded-3xl p-4">
        <View className="flex-row items-center gap-3">
          <Spinner size="sm" />
          <View className="flex-1">
            <Text className="text-sm font-medium text-foreground">
              Uploading {finished + 1} of {uploads.length}
            </Text>
            <Text numberOfLines={1} className="font-normal text-xs text-muted">
              {current.name}
            </Text>
          </View>
          <Pressable
            onPress={() => cancel(current.id)}
            hitSlop={8}
            className="size-8 items-center justify-center rounded-xl active:bg-default"
            accessibilityLabel={`Cancel ${current.name}`}
          >
            <Icon icon={X} size={18} className="text-muted" />
          </Pressable>
        </View>
        <UploadProgress value={current.progress} />
      </Surface>
    </Pressable>
  );
}

type UploadsSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  folderKey: string;
};

/** Each upload going to a folder, with its progress and cancel, like the web's panel. */
export function UploadsSheet({
  isOpen,
  onOpenChange,
  folderKey,
}: UploadsSheetProps) {
  const uploads = useFolderUploads(folderKey);
  const cancel = useUploads((state) => state.cancel);
  const running = uploads.filter(isRunning);
  const finished = uploads.length - running.length;

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Uploads"
      description={`${finished} of ${uploads.length} finished`}
      scrollable
    >
      <View className="flex-1 gap-3 pb-2">
        <BottomSheetScrollView style={{ flex: 1 }}>
          {uploads.map((upload, index) => (
            <Fragment key={upload.id}>
              {index > 0 ? <Separator /> : null}
              <UploadRow upload={upload} />
            </Fragment>
          ))}
        </BottomSheetScrollView>
        {running.length > 0 ? (
          <Button
            variant="danger"
            onPress={() => {
              for (const upload of running) cancel(upload.id);
            }}
          >
            {running.length === 1 ? "Cancel upload" : "Cancel all"}
          </Button>
        ) : null}
      </View>
    </Sheet>
  );
}
