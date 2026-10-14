import type { File } from "@darseen/vaze";
import { Image } from "expo-image";
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
};

export function FileThumb({ file, size = 40, wide = false }: FileThumbProps) {
  const { server, vaze, headers } = useServer();
  const [failed, setFailed] = useState(false);
  const kind = fileKind(file.name, file.mimeType);
  const { icon, tint } = KIND_INFO[kind];
  const box = wide
    ? { width: "100%" as const, height: size }
    : { width: size, height: size };

  if (kind === "image" && !failed) {
    return (
      <View className="overflow-hidden rounded-xl bg-default" style={box}>
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
      className="items-center justify-center rounded-xl bg-default"
      style={box}
    >
      <Icon icon={icon} className={tint} size={Math.min(size * 0.5, 40)} />
    </View>
  );
}
