import type { File } from "@darseen/vaze";
import { cn } from "heroui-native";
import { View } from "react-native";
import { FilePreview } from "./file-preview";

type FileThumbProps = {
  file: File;
  size?: number;
  /** Fills the parent's width with a full preview instead of a small square. */
  wide?: boolean;
  className?: string;
};

export function FileThumb({
  file,
  size = 40,
  wide = false,
  className,
}: FileThumbProps) {
  return (
    <View
      className={cn("overflow-hidden rounded-xl bg-default", className)}
      style={
        wide ? { width: "100%", height: size } : { width: size, height: size }
      }
    >
      <FilePreview file={file} compact={!wide} />
    </View>
  );
}
