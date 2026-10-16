import type { File } from "@darseen/vaze";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Spinner, useToast } from "heroui-native";
import {
  EllipsisVertical,
  Lock,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScopedTheme } from "uniwind";
import { useFolderEntries } from "@/hooks/use-folder-entries";
import { previewKind } from "@/lib/file-kind";
import { formatBytes } from "@/lib/format";
import { shareFile } from "@/lib/transfer";
import { useLibrary } from "@/stores/library";
import { useEntryActions } from "../files/entry-actions";
import { FilePreview } from "../files/file-preview";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { AudioView } from "./audio-view";
import { ImageView } from "./image-view";
import { PdfView } from "./pdf-view";
import { NoPreview, TypeTile } from "./status";
import { TextView } from "./text-view";
import { VIEWER_BACKGROUND } from "./theme";
import { VideoView } from "./video-view";

type Size = { width: number; height: number };

const THUMB = 56;
const THUMB_GAP = 8;
const STRIP_PADDING = 16;

function Placeholder({ file }: { file: File }) {
  return (
    <View className="flex-1 items-center justify-center">
      <TypeTile file={file} />
    </View>
  );
}

function FileContent({
  file,
  active,
  near,
  page,
  onZoomChange,
}: {
  file: File;
  active: boolean;
  near: boolean;
  page: Size;
  onZoomChange: (zoomed: boolean) => void;
}) {
  if (file.size === 0) {
    return <NoPreview file={file} message="This file is empty" />;
  }

  switch (previewKind(file)) {
    case "image":
      // the images either side load in the background, so stepping is instant
      return near ? (
        <ImageView
          file={file}
          page={page}
          active={active}
          onZoomChange={onZoomChange}
        />
      ) : null;
    case "video":
      return <VideoView file={file} active={active} />;
    case "audio":
      return <AudioView file={file} active={active} />;
    case "pdf":
      return active ? (
        <PdfView file={file} pageWidth={page.width} />
      ) : (
        <Placeholder file={file} />
      );
    case "text":
      return active ? <TextView file={file} /> : <Placeholder file={file} />;
    default:
      return (
        <NoPreview file={file} message="No preview for this type of file" />
      );
  }
}

function HeaderButton({
  icon,
  label,
  busy = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={4}
      className="size-10 items-center justify-center rounded-full active:bg-default"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? <Spinner size="sm" /> : <Icon icon={icon} size={22} />}
    </Pressable>
  );
}

function Filmstrip({
  files,
  index,
  onSelect,
}: {
  files: File[];
  index: number;
  onSelect: (index: number) => void;
}) {
  const strip = useRef<FlatList<File>>(null);
  const scrolled = useRef(false);
  const { bottom } = useSafeAreaInsets();

  // keep the current file in the middle of the strip
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      strip.current?.scrollToIndex({
        index,
        viewPosition: 0.5,
        // jumping straight there on open, gliding after
        animated: scrolled.current,
      });
      scrolled.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [index]);

  return (
    <View style={{ paddingBottom: bottom }} className="border-t border-border">
      <FlatList
        ref={strip}
        horizontal
        data={files}
        extraData={index}
        keyExtractor={(file) => file.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: STRIP_PADDING,
          paddingVertical: 12,
        }}
        ItemSeparatorComponent={() => <View style={{ width: THUMB_GAP }} />}
        getItemLayout={(_files, at) => ({
          length: THUMB + THUMB_GAP,
          offset: STRIP_PADDING + (THUMB + THUMB_GAP) * at,
          index: at,
        })}
        onScrollToIndexFailed={() => {}}
        windowSize={5}
        renderItem={({ item, index: at }) => (
          <Pressable
            onPress={() => onSelect(at)}
            // the ring is an overlay, so selecting never resizes the preview
            style={{
              width: THUMB,
              height: THUMB,
              opacity: at === index ? 1 : 0.5,
            }}
            className="overflow-hidden rounded-md bg-default"
            accessibilityRole="button"
            accessibilityLabel={item.name}
            accessibilityState={{ selected: at === index }}
          >
            <FilePreview file={item} compact />
            {at === index ? (
              <View
                pointerEvents="none"
                className="absolute inset-0 rounded-md border-2 border-foreground"
              />
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

export function FileViewer({
  folderKey,
  fileId,
  query,
}: {
  folderKey: string;
  fileId: string;
  query?: string;
}) {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  const { top } = useSafeAreaInsets();
  const actions = useEntryActions();
  const loadFolder = useLibrary((state) => state.loadFolder);
  // pages through what the folder's search showed, like the web
  const { contents, entries } = useFolderEntries(server.id, folderKey, query);
  const files = useMemo(
    () =>
      entries.flatMap((entry) => (entry.type === "file" ? [entry.file] : [])),
    [entries],
  );

  const [currentId, setCurrentId] = useState(fileId);
  const [page, setPage] = useState<Size | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pager = useRef<FlatList<File>>(null);
  const shown = useRef(-1);
  const lastIndex = useRef(0);

  const found = files.findIndex((file) => file.id === currentId);
  // a deleted or moved file hands the page to the one that took its place
  const index =
    found === -1 && files.length > 0
      ? Math.min(lastIndex.current, files.length - 1)
      : found;
  const file = index === -1 ? undefined : files[index];

  useEffect(() => {
    // only a viewer opened without its folder cached needs to load it
    if (!contents?.data) loadFolder(server.id, vaze, folderKey);
  }, []);

  useEffect(() => {
    if (index !== -1) lastIndex.current = index;
    if (file && file.id !== currentId) setCurrentId(file.id);
    if (contents?.data && files.length === 0) router.back();
  }, [index, file, currentId, contents?.data, files.length]);

  // follows changes the pager didn't make, such as a filmstrip tap
  useEffect(() => {
    if (!page || index === -1 || shown.current === index) return;
    if (shown.current !== -1) {
      pager.current?.scrollToIndex({ index, animated: false });
    }
    shown.current = index;
  }, [index, page]);

  const go = (to: number) => {
    const next = files[to];
    if (!next) return;
    setZoomed(false);
    setCurrentId(next.id);
  };

  async function share() {
    if (!file) return;
    setSharing(true);
    try {
      await shareFile(vaze, file);
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't share the file",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScopedTheme theme="dark">
      <StatusBar style="light" />
      <View className="flex-1" style={{ backgroundColor: VIEWER_BACKGROUND }}>
        <View style={{ paddingTop: top }} className="border-b border-border">
          <View className="h-14 flex-row items-center gap-1 px-2">
            <HeaderButton
              icon={X}
              label="Close"
              onPress={() => router.back()}
            />
            <View className="flex-1 px-1">
              <Text
                numberOfLines={1}
                className="text-sm font-medium text-foreground"
              >
                {file?.name ?? ""}
              </Text>
              {file ? (
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-normal text-xs text-muted">
                    {files.length > 1
                      ? `${index + 1} of ${files.length} · `
                      : ""}
                    {formatBytes(file.size)}
                  </Text>
                  {file.visibility === "private" ? (
                    <>
                      <Text className="font-normal text-xs text-muted">·</Text>
                      <Icon icon={Lock} size={12} className="text-muted" />
                      <Text className="font-normal text-xs text-muted">
                        Private
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
            {file ? (
              <>
                <HeaderButton
                  icon={Share2}
                  label="Share"
                  busy={sharing}
                  onPress={share}
                />
                <HeaderButton
                  icon={EllipsisVertical}
                  label="Options"
                  onPress={() => actions.open({ type: "file", file })}
                />
              </>
            ) : null}
          </View>
        </View>

        <View
          className="flex-1"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPage({ width, height });
          }}
        >
          {page && file ? (
            <FlatList
              ref={pager}
              data={files}
              extraData={index}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!zoomed}
              initialScrollIndex={index}
              getItemLayout={(_files, at) => ({
                length: page.width,
                offset: page.width * at,
                index: at,
              })}
              initialNumToRender={1}
              maxToRenderPerBatch={1}
              windowSize={3}
              keyExtractor={(item) => item.id}
              onMomentumScrollEnd={(event) => {
                const at = Math.round(
                  event.nativeEvent.contentOffset.x / page.width,
                );
                shown.current = at;
                if (files[at] && at !== index) go(at);
              }}
              renderItem={({ item, index: at }) => (
                <View style={page}>
                  <FileContent
                    file={item}
                    active={at === index}
                    near={Math.abs(at - index) <= 1}
                    page={page}
                    onZoomChange={setZoomed}
                  />
                </View>
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Spinner />
            </View>
          )}
        </View>

        {files.length > 1 ? (
          <Filmstrip files={files} index={index} onSelect={go} />
        ) : null}
      </View>
      {actions.element}
    </ScopedTheme>
  );
}
