import type { File } from "@darseen/vaze";
import { useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView as NativeVideoView } from "expo-video";
import { Play } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { claimPlayback, releasePlayback } from "@/lib/playback";
import { usePreview, videoPoster } from "@/lib/previews";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { NoPreview, TypeTile } from "./status";

function Poster({ file }: { file: File }) {
  const { server, headers } = useServer();
  const poster = usePreview(`poster:${server.id}:${file.id}`, () =>
    videoPoster({ serverId: server.id, headers }, file),
  );

  return (
    <View className="absolute inset-0 items-center justify-center">
      {poster.status === "loaded" ? (
        <Image
          source={{ uri: poster.value.uri }}
          style={{ position: "absolute", inset: 0 }}
          contentFit="contain"
        />
      ) : poster.status === "failed" ? (
        <TypeTile file={file} />
      ) : null}
    </View>
  );
}

function Player({ file }: { file: File }) {
  const { headers } = useServer();
  const [failed, setFailed] = useState(false);
  const [rendered, setRendered] = useState(false);
  const player = useVideoPlayer({ uri: file.url, headers }, (created) => {
    created.play();
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") setFailed(true);
  });

  useEffect(() => {
    const pause = () => player.pause();
    const subscription = player.addListener(
      "playingChange",
      ({ isPlaying }) => {
        if (isPlaying) claimPlayback(pause);
      },
    );
    return () => {
      subscription.remove();
      releasePlayback(pause);
    };
  }, [player]);

  if (failed) {
    return <NoPreview file={file} message="This video can't be played here" />;
  }

  return (
    <View className="flex-1">
      {rendered ? null : <Poster file={file} />}
      <NativeVideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
        // one video per page, so there is no track to skip to
        buttonOptions={{ showNext: false, showPrevious: false }}
        onFirstFrameRender={() => setRendered(true)}
      />
    </View>
  );
}

/** Plays only on the page in view; its neighbours show the poster. */
export function VideoView({ file, active }: { file: File; active: boolean }) {
  if (active) return <Player file={file} />;

  return (
    <View className="flex-1">
      <Poster file={file} />
      <View className="absolute inset-0 items-center justify-center">
        <View className="size-16 items-center justify-center rounded-full bg-black/50">
          <Icon icon={Play} size={28} filled className="text-white" />
        </View>
      </View>
    </View>
  );
}
