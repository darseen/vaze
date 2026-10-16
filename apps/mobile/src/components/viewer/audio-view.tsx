import type { File } from "@darseen/vaze";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { cn, Spinner } from "heroui-native";
import { Music, Pause, Play, RotateCcw, RotateCw } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { formatDuration } from "@/lib/format";
import { claimPlayback, releasePlayback } from "@/lib/playback";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { NoPreview } from "./status";

const SKIP_SECONDS = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function SeekBar({
  time,
  duration,
  onSeek,
}: {
  time: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const disabled = duration <= 0 || width === 0;
  const valueAt = (x: number) => clamp(x / width, 0, 1) * duration;
  const shown = dragging ?? time;
  const percent = disabled ? 0 : clamp(shown / duration, 0, 1) * 100;

  // claims the drag from the pager once it moves sideways
  const drag = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled)
    .activeOffsetX([-4, 4])
    .onStart((event) => setDragging(valueAt(event.x)))
    .onUpdate((event) => setDragging(valueAt(event.x)))
    .onEnd((event) => onSeek(valueAt(event.x)))
    .onFinalize(() => setDragging(null));

  const tap = Gesture.Tap()
    .runOnJS(true)
    .enabled(!disabled)
    .onEnd((event, success) => {
      if (success) onSeek(valueAt(event.x));
    });

  return (
    <View className="gap-2">
      <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className="h-8 justify-center"
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
          accessibilityValue={{
            text: `${formatDuration(shown)} of ${formatDuration(duration)}`,
          }}
        >
          <View className="h-1 overflow-hidden rounded-full bg-foreground/25">
            <View
              className="h-full bg-foreground"
              style={{ width: `${percent}%` }}
            />
          </View>
          <View
            pointerEvents="none"
            className={cn(
              "absolute size-3.5 rounded-full bg-foreground",
              dragging !== null && "size-4",
            )}
            style={{
              left: `${percent}%`,
              transform: [{ translateX: dragging !== null ? -8 : -7 }],
            }}
          />
        </View>
      </GestureDetector>
      <View className="flex-row justify-between">
        <Text className="font-normal text-xs text-muted tabular-nums">
          {formatDuration(shown)}
        </Text>
        <Text className="font-normal text-xs text-muted tabular-nums">
          {formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
}

function SkipButton({
  forward = false,
  onPress,
}: {
  forward?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="size-14 items-center justify-center rounded-full active:bg-default"
      accessibilityLabel={`${forward ? "Forward" : "Back"} ${SKIP_SECONDS} seconds`}
    >
      <Icon icon={forward ? RotateCw : RotateCcw} size={30} strokeWidth={1.5} />
      <Text className="absolute text-[9px] font-bold text-foreground">
        {SKIP_SECONDS}
      </Text>
    </Pressable>
  );
}

type ControlsProps = {
  time: number;
  duration: number;
  playing: boolean;
  waiting: boolean;
  onSeek: (seconds: number) => void;
  onToggle: () => void;
};

function Controls({
  time,
  duration,
  playing,
  waiting,
  onSeek,
  onToggle,
}: ControlsProps) {
  return (
    <View className="w-full gap-4">
      <SeekBar time={time} duration={duration} onSeek={onSeek} />
      <View className="flex-row items-center justify-center gap-6">
        <SkipButton onPress={() => onSeek(time - SKIP_SECONDS)} />
        <Pressable
          onPress={onToggle}
          className="size-16 items-center justify-center rounded-full bg-accent active:scale-95"
          accessibilityLabel={playing ? "Pause" : "Play"}
        >
          {waiting && !playing ? (
            <Spinner size="sm" />
          ) : (
            <Icon
              icon={playing ? Pause : Play}
              size={26}
              filled
              className="text-accent-foreground"
            />
          )}
        </Pressable>
        <SkipButton forward onPress={() => onSeek(time + SKIP_SECONDS)} />
      </View>
    </View>
  );
}

function Artwork({ playing }: { playing: boolean }) {
  return (
    <View className="size-40 items-center justify-center rounded-3xl bg-default">
      <Icon
        icon={Music}
        size={64}
        strokeWidth={1.5}
        className={playing ? "text-foreground" : "text-muted"}
      />
    </View>
  );
}

function Player({ file }: { file: File }) {
  const { headers } = useServer();
  const player = useAudioPlayer(
    { uri: file.url, headers },
    { updateInterval: 200 },
  );
  const status = useAudioPlayerStatus(player);

  // one stable stop callback, so claiming twice doesn't stop itself
  const [pause] = useState(() => () => player.pause());

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    claimPlayback(pause);
    player.play();
    return () => releasePlayback(pause);
  }, [player, pause]);

  if (status.error) {
    return <NoPreview file={file} message="This audio can't be played here" />;
  }

  const { currentTime: time, duration, playing } = status;

  const seek = (to: number) => {
    if (duration > 0) player.seekTo(clamp(to, 0, duration));
  };

  const toggle = () => {
    if (playing) {
      player.pause();
      return;
    }
    if (duration > 0 && time >= duration - 0.1) player.seekTo(0);
    claimPlayback(pause);
    player.play();
  };

  return (
    <View className="flex-1 items-center justify-center gap-12 px-8">
      <Artwork playing={playing} />
      <Controls
        time={time}
        duration={duration}
        playing={playing}
        waiting={!status.isLoaded || status.isBuffering}
        onSeek={seek}
        onToggle={toggle}
      />
    </View>
  );
}

/** Plays only on the page in view, like the web's player. */
export function AudioView({ file, active }: { file: File; active: boolean }) {
  if (active) return <Player file={file} />;

  return (
    <View className="flex-1 items-center justify-center gap-12 px-8">
      <Artwork playing={false} />
      <Controls
        time={0}
        duration={0}
        playing={false}
        waiting={false}
        onSeek={() => {}}
        onToggle={() => {}}
      />
    </View>
  );
}
