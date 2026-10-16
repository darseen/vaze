import type { File } from "@darseen/vaze";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useServer } from "../server-context";
import { Loading, NoPreview } from "./status";

const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;

type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(Math.max(value, min), max);
};

/** The image's box inside the page; photos never grow past their own size. */
function fit(natural: Size, page: Size, vector: boolean): Size {
  let scale = Math.min(
    page.width / natural.width,
    page.height / natural.height,
  );
  if (!vector) scale = Math.min(scale, 1);
  return { width: natural.width * scale, height: natural.height * scale };
}

export function ImageView({
  file,
  page,
  active,
  onZoomChange,
}: {
  file: File;
  page: Size;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const { server, headers } = useServer();
  const [natural, setNatural] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  // vectors scale up cleanly, while photos stay at their natural size or less
  const vector = /\.svg$/i.test(file.name);
  const box = natural ? fit(natural, page, vector) : page;

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const start = useSharedValue({ scale: 1, x: 0, y: 0, focalX: 0, focalY: 0 });

  // a page swiped away comes back unzoomed
  useEffect(() => {
    if (active) return;
    scale.value = 1;
    x.value = 0;
    y.value = 0;
  }, [active, scale, x, y]);

  const limits = (at: number) => {
    "worklet";
    return {
      x: Math.max((box.width * at - page.width) / 2, 0),
      y: Math.max((box.height * at - page.height) / 2, 0),
    };
  };

  const settle = () => {
    "worklet";
    if (scale.value <= 1) {
      scale.value = withTiming(1);
      x.value = withTiming(0);
      y.value = withTiming(0);
      scheduleOnRN(onZoomChange, false);
      return;
    }
    const bounds = limits(scale.value);
    x.value = withTiming(clamp(x.value, -bounds.x, bounds.x));
    y.value = withTiming(clamp(y.value, -bounds.y, bounds.y));
    scheduleOnRN(onZoomChange, true);
  };

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      start.value = {
        scale: scale.value,
        x: x.value,
        y: y.value,
        focalX: event.focalX - page.width / 2,
        focalY: event.focalY - page.height / 2,
      };
    })
    .onUpdate((event) => {
      const from = start.value;
      const next = clamp(from.scale * event.scale, 0.75, MAX_SCALE);
      const ratio = next / from.scale;
      // the point under the fingers stays under them, and follows them
      scale.value = next;
      x.value = event.focalX - page.width / 2 - (from.focalX - from.x) * ratio;
      y.value = event.focalY - page.height / 2 - (from.focalY - from.y) * ratio;
    })
    .onEnd(settle);

  // at rest the page belongs to the pager, so a drag only pans when zoomed in
  const pan = Gesture.Pan()
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesMove((_event, manager) => {
      if (scale.value > 1) manager.activate();
      else manager.fail();
    })
    .onStart(() => {
      start.value = { ...start.value, x: x.value, y: y.value };
    })
    .onUpdate((event) => {
      const bounds = limits(scale.value);
      x.value = clamp(start.value.x + event.translationX, -bounds.x, bounds.x);
      y.value = clamp(start.value.y + event.translationY, -bounds.y, bounds.y);
    })
    .onEnd((event) => {
      const bounds = limits(scale.value);
      x.value = withDecay({
        velocity: event.velocityX,
        clamp: [-bounds.x, bounds.x],
      });
      y.value = withDecay({
        velocity: event.velocityY,
        clamp: [-bounds.y, bounds.y],
      });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (!success) return;
      if (scale.value > 1) {
        scale.value = withTiming(1);
        x.value = withTiming(0);
        y.value = withTiming(0);
        scheduleOnRN(onZoomChange, false);
        return;
      }

      // zoom in on the tapped point
      const bounds = limits(DOUBLE_TAP_SCALE);
      const tapX = event.x - page.width / 2;
      const tapY = event.y - page.height / 2;
      scale.value = withTiming(DOUBLE_TAP_SCALE);
      x.value = withTiming(
        clamp(-tapX * (DOUBLE_TAP_SCALE - 1), -bounds.x, bounds.x),
      );
      y.value = withTiming(
        clamp(-tapY * (DOUBLE_TAP_SCALE - 1), -bounds.y, bounds.y),
      );
      scheduleOnRN(onZoomChange, true);
    });

  const zoom = Gesture.Simultaneous(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  if (failed) {
    return <NoPreview file={file} message="This image couldn't be loaded" />;
  }

  const source = {
    uri: file.url,
    headers,
    cacheKey: `${server.id}:file:${file.id}`,
  };

  return (
    <GestureDetector gesture={zoom}>
      <View
        collapsable={false}
        style={page}
        className="items-center justify-center overflow-hidden"
      >
        {natural ? null : (
          <View className="absolute inset-0">
            <Loading />
          </View>
        )}
        <Animated.View style={[box, style]}>
          <Image
            source={source}
            style={{ flex: 1 }}
            contentFit="contain"
            transition={150}
            onLoad={({ source: loaded }) => {
              if (!natural && loaded.width > 0 && loaded.height > 0) {
                setNatural({ width: loaded.width, height: loaded.height });
              }
            }}
            onError={() => setFailed(true)}
          />
          {natural && active ? (
            // filling its own box it decodes at full size, so only the page in view does
            <Image
              source={source}
              style={{ position: "absolute", inset: 0 }}
              contentFit="fill"
            />
          ) : null}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
