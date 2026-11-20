import { Stack, useLocalSearchParams } from "expo-router";
import { FileQuestion } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { ImageConverter } from "@/components/conversion/image-converter";
import { VideoConverter } from "@/components/conversion/video-converter";
import { VideoToAudio } from "@/components/conversion/video-to-audio";
import { EmptyState } from "@/components/empty-state";
import { clearConversions } from "@/lib/conversion";
import { findTool } from "@/lib/tools";

const SCREENS: Record<
  string,
  (props: { fileId?: string }) => React.JSX.Element
> = {
  video: VideoConverter,
  "video-to-audio": VideoToAudio,
  image: ImageConverter,
};

export default function ConversionToolScreen() {
  // `file` is a stored file to start with, set by a file's Convert action
  const { tool: slug, file } = useLocalSearchParams<{
    tool: string;
    file?: string;
  }>();
  const tool = findTool("conversion", slug);

  // earlier results stay until now in case a share is still reading one
  useEffect(() => {
    clearConversions();
  }, []);

  const Screen = tool ? SCREENS[tool.slug] : undefined;
  if (!tool || !Screen) {
    return (
      <View className="px-5 pt-6">
        <Stack.Screen options={{ title: "Conversion" }} />
        <EmptyState
          icon={FileQuestion}
          title="No such tool"
          message="This link points at a conversion the app doesn't have."
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: tool.title }} />
      <Screen fileId={file} />
    </>
  );
}
