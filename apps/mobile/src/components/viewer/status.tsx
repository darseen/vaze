import type { File } from "@darseen/vaze";
import { Button, Spinner } from "heroui-native";
import { Download, Share2 } from "lucide-react-native";
import { Platform, Text, View } from "react-native";
import { useDownload } from "@/hooks/use-download";
import { fileKind, KIND_INFO } from "@/lib/file-kind";
import { formatBytes } from "@/lib/format";
import { fileDownload } from "@/lib/transfer";
import { Icon } from "../icon";
import { useServer } from "../server-context";

export function Loading({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Spinner />
      {label ? (
        <Text className="font-normal text-sm text-muted">{label}</Text>
      ) : null}
    </View>
  );
}

/** The file's type icon, for a page that isn't showing its file yet. */
export function TypeTile({ file }: { file: File }) {
  return (
    <View className="size-24 items-center justify-center rounded-2xl bg-default">
      <Icon
        icon={KIND_INFO[fileKind(file.name, file.mimeType)].icon}
        size={44}
        strokeWidth={1.5}
        className="text-muted"
      />
    </View>
  );
}

export function NoPreview({ file, message }: { file: File; message: string }) {
  const { vaze } = useServer();
  const { download, busy } = useDownload();
  const android = Platform.OS === "android";

  return (
    <View className="flex-1 items-center justify-center gap-5 p-6">
      <TypeTile file={file} />
      <View className="items-center gap-1">
        <Text className="text-center text-base font-medium text-foreground">
          {message}
        </Text>
        <Text className="font-normal text-sm text-muted">
          {formatBytes(file.size)}
        </Text>
      </View>
      <Button
        variant="secondary"
        onPress={() => download(fileDownload(vaze, file))}
        isDisabled={busy}
      >
        {busy ? (
          <Spinner size="sm" />
        ) : (
          <Icon icon={android ? Download : Share2} size={18} />
        )}
        <Button.Label>{android ? "Download" : "Share"}</Button.Label>
      </Button>
    </View>
  );
}
