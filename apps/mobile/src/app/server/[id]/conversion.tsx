import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { ImageConverter } from "@/components/conversion/image-converter";
import { VideoToAudio } from "@/components/conversion/video-to-audio";
import { useServer } from "@/components/server-context";
import { clearConversions } from "@/lib/conversion";
import { useLibrary } from "@/stores/library";

export default function ConversionScreen() {
  const { server } = useServer();
  const support = useLibrary((state) => state.conversion[server.id]);
  // set by a file's Convert action: a video starts right away, an image waits for its options
  const { file: videoId, image: imageId } = useLocalSearchParams<{
    file?: string;
    image?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);
  // the image card scrolls into view once it has grown to show that image
  const scrollPendingRef = useRef(false);

  // earlier visits' results stay until now in case a share is still reading one
  useEffect(() => {
    clearConversions();
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerClassName="gap-6 px-5 pt-3 pb-8"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="font-normal text-sm text-muted">
        Convert files from one format to another.
      </Text>

      {support?.video !== false ? <VideoToAudio fileId={videoId} /> : null}

      {support?.image !== false ? (
        <View
          onLayout={(event) => {
            if (!scrollPendingRef.current) return;
            scrollPendingRef.current = false;
            scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y });
          }}
        >
          <ImageConverter
            fileId={imageId}
            onLoaded={() => {
              scrollPendingRef.current = true;
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
