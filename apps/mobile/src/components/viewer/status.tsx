import type { File } from "@darseen/vaze";
import { Button, Spinner } from "heroui-native";
import { Share2 } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { fileKind, KIND_INFO } from "@/lib/file-kind";
import { formatBytes } from "@/lib/format";
import { shareFile } from "@/lib/transfer";
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
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setSharing(true);
    setError(null);
    try {
      await shareFile(vaze, file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't share it");
    } finally {
      setSharing(false);
    }
  }

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
      <Button variant="secondary" onPress={share} isDisabled={sharing}>
        {sharing ? <Spinner size="sm" /> : <Icon icon={Share2} size={18} />}
        <Button.Label>Share</Button.Label>
      </Button>
      {error ? (
        <Text className="font-normal text-center text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
