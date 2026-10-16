import type { File } from "@darseen/vaze";
import { Image } from "expo-image";
import { cn } from "heroui-native";
import { Pause, Play } from "lucide-react-native";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  extensionOf,
  fileKind,
  KIND_INFO,
  previewKind,
  type PreviewKind,
} from "@/lib/file-kind";
import { formatDuration } from "@/lib/format";
import { useCardAudio } from "@/lib/playback";
import {
  pdfCover,
  textStart,
  usePreview,
  videoPoster,
  type PreviewState,
} from "@/lib/previews";
import { Icon } from "../icon";
import { useServer } from "../server-context";

type Status = "loading" | "loaded" | "failed";

// thumbnails in rows and the filmstrip, too small for badges and labels
const CompactContext = createContext(false);

function TypeIcon({ file }: { file: File }) {
  const compact = useContext(CompactContext);
  const icon = KIND_INFO[fileKind(file.name, file.mimeType)].icon;
  const extension = extensionOf(file.name).toUpperCase();

  if (compact) return <Icon icon={icon} size={20} className="text-muted" />;

  return (
    <View>
      <Icon icon={icon} size={44} strokeWidth={1.5} className="text-muted" />
      {extension ? (
        <View className="absolute -right-2.5 -bottom-1.5 rounded-md bg-accent px-1.5 py-0.5">
          <Text className="text-[10px] font-medium text-accent-foreground">
            {extension}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <View
      pointerEvents="none"
      className="absolute right-2 bottom-2 flex-row items-center gap-1 rounded-lg border border-border bg-background/80 px-1.5 py-0.5"
    >
      {children}
    </View>
  );
}

function BadgeText({ children }: { children: ReactNode }) {
  return <Text className="text-xs font-medium text-muted">{children}</Text>;
}

/** A page peeking up from the bottom edge, for documents. */
function Sheet({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const compact = useContext(CompactContext);

  return (
    <View
      className={cn(
        "absolute inset-x-6 top-4 bottom-0 overflow-hidden rounded-t-md border border-b-0 border-border",
        compact && "inset-x-1.5 top-1.5",
        className,
      )}
    >
      {children}
    </View>
  );
}

/** Shows the type icon until the preview is ready, and again if it fails. */
function PreviewFrame({
  file,
  status,
  badge,
  children,
}: {
  file: File;
  status: Status;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const compact = useContext(CompactContext);
  if (status === "failed") return <TypeIcon file={file} />;

  const extension = extensionOf(file.name).toUpperCase();
  const label = compact
    ? null
    : (badge ?? (extension ? <BadgeText>{extension}</BadgeText> : null));

  return (
    <>
      {status === "loading" ? <TypeIcon file={file} /> : null}
      <View
        className={cn("absolute inset-0", status === "loading" && "opacity-0")}
      >
        {children}
      </View>
      {status === "loaded" && label ? <Badge>{label}</Badge> : null}
    </>
  );
}

const statusOf = (state: PreviewState<unknown>): Status => state.status;

function ImagePreview({ file }: { file: File }) {
  const { server, vaze, headers } = useServer();
  const compact = useContext(CompactContext);
  const [status, setStatus] = useState<Status>("loading");
  // logos and icons are small as-is, and cropping would cut into them
  const contain = /\.(svg|ico)$/i.test(file.name);

  return (
    <PreviewFrame file={file} status={status}>
      <Image
        source={{
          uri: contain ? file.url : vaze.files.thumbnailUrl(file.id),
          headers,
          cacheKey: `${server.id}:${contain ? "file" : "thumb"}:${file.id}`,
        }}
        style={{ flex: 1, margin: contain ? (compact ? 6 : 16) : 0 }}
        contentFit={contain ? "contain" : "cover"}
        transition={150}
        recyclingKey={file.id}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
      />
    </PreviewFrame>
  );
}

function VideoPreview({ file }: { file: File }) {
  const { server, headers } = useServer();
  const poster = usePreview(`poster:${server.id}:${file.id}`, () =>
    videoPoster({ serverId: server.id, headers }, file),
  );
  const duration = poster.status === "loaded" ? poster.value.duration : 0;

  return (
    <PreviewFrame
      file={file}
      status={statusOf(poster)}
      badge={
        duration > 0 ? (
          <>
            <Icon icon={Play} size={11} filled className="text-muted" />
            <BadgeText>{formatDuration(duration)}</BadgeText>
          </>
        ) : undefined
      }
    >
      {poster.status === "loaded" ? (
        <Image
          source={{ uri: poster.value.uri }}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={150}
          recyclingKey={file.id}
        />
      ) : null}
    </PreviewFrame>
  );
}

function PdfPreview({ file }: { file: File }) {
  const { server, headers } = useServer();
  const cover = usePreview(`cover:${server.id}:${file.id}`, () =>
    pdfCover({ serverId: server.id, headers }, file),
  );

  return (
    <PreviewFrame file={file} status={statusOf(cover)}>
      <Sheet className="bg-white">
        {cover.status === "loaded" ? (
          <Image
            source={{ uri: cover.value }}
            style={{ flex: 1 }}
            contentFit="cover"
            contentPosition="top"
            transition={150}
            recyclingKey={file.id}
          />
        ) : null}
      </Sheet>
    </PreviewFrame>
  );
}

function TextPreview({ file }: { file: File }) {
  const { server, headers } = useServer();
  const text = usePreview(`text:${server.id}:${file.id}`, () =>
    textStart({ serverId: server.id, headers }, file),
  );

  return (
    <PreviewFrame file={file} status={statusOf(text)}>
      <Sheet className="bg-background">
        <Text
          className="p-2.5 text-[8px] leading-3 text-muted"
          style={{ fontFamily: "monospace" }}
        >
          {text.status === "loaded" ? text.value : ""}
        </Text>
      </Sheet>
    </PreviewFrame>
  );
}

function AudioPreview({ file }: { file: File }) {
  const { headers } = useServer();
  const current = useCardAudio((state) => state.fileId === file.id);
  const playing = useCardAudio((state) => current && state.playing);
  const progress = useCardAudio((state) => (current ? state.progress : 0));
  const failed = useCardAudio((state) => state.failed[file.id] === true);
  const toggle = useCardAudio((state) => state.toggle);

  if (failed) return <TypeIcon file={file} />;
  const extension = extensionOf(file.name).toUpperCase();

  return (
    <>
      <Pressable
        onPress={() => toggle(file.id, { uri: file.url, headers })}
        hitSlop={8}
        className="size-12 items-center justify-center rounded-full bg-accent active:scale-95"
        accessibilityRole="button"
        accessibilityLabel={`${playing ? "Pause" : "Play"} ${file.name}`}
      >
        <Icon
          icon={playing ? Pause : Play}
          size={20}
          filled
          className="text-accent-foreground"
        />
      </Pressable>

      {extension ? (
        <Badge>
          <BadgeText>{extension}</BadgeText>
        </Badge>
      ) : null}

      {progress > 0 ? (
        <View className="absolute inset-x-0 bottom-0 h-1 bg-accent/20">
          <View
            className="h-full bg-accent"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
      ) : null}
    </>
  );
}

const PREVIEWS: Record<PreviewKind, (props: { file: File }) => ReactNode> = {
  image: ImagePreview,
  video: VideoPreview,
  audio: AudioPreview,
  pdf: PdfPreview,
  text: TextPreview,
};

/** Fills its parent with the file's preview, like the web's cards. */
export function FilePreview({
  file,
  compact = false,
}: {
  file: File;
  compact?: boolean;
}) {
  let kind = previewKind(file);
  // audio needs its play button and text needs room to be read
  if (compact && (kind === "audio" || kind === "text")) kind = null;
  const Preview = kind ? PREVIEWS[kind] : null;

  return (
    <CompactContext value={compact}>
      <View className="absolute inset-0 items-center justify-center">
        {Preview ? (
          // keyed so a rename starts fresh
          <Preview key={file.url} file={file} />
        ) : (
          <TypeIcon file={file} />
        )}
      </View>
    </CompactContext>
  );
}
