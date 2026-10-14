import type { File } from "@darseen/vaze";
import { Image } from "expo-image";
import { cn } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import { fileKind, KIND_INFO } from "@/lib/file-kind";
import { Icon } from "../icon";
import { useServer } from "../server-context";

type FileThumbProps = {
  file: File;
  size?: number;
  /** Fills the parent's width instead of a fixed square. */
  wide?: boolean;
  className?: string;
};

export function FileThumb({
  file,
  size = 40,
  wide = false,
  className,
}: FileThumbProps) {
  const { server, vaze, headers } = useServer();
  const [failed, setFailed] = useState(false);
  const kind = fileKind(file.name, file.mimeType);
  const box = wide
    ? { width: "100%" as const, height: size }
    : { width: size, height: size };

  if (kind === "image" && !failed) {
    return (
      <View
        className={cn("overflow-hidden rounded-xl bg-default", className)}
        style={box}
      >
        <Image
          source={{
            uri: vaze.files.thumbnailUrl(file.id),
            headers,
            cacheKey: `${server.id}:thumb:${file.id}`,
          }}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={150}
          recyclingKey={file.id}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      className={cn(
        "items-center justify-center rounded-xl bg-default",
        className,
      )}
      style={box}
    >
      <Icon
        icon={KIND_INFO[kind].icon}
        className="text-muted"
        size={Math.min(size * 0.5, 40)}
      />
    </View>
  );
}
