import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import {
  getFileCategory,
  getPreviewKind,
  type FileCategory,
  type PreviewKind,
} from "@/utils/file-type";
import type { FileWithUrl } from "@repo/types";
import {
  FileArchive,
  FileCode,
  FileIcon,
  FileImage,
  FileMusic,
  FileText,
  FileVideo,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Status = "loading" | "loaded" | "failed";

interface PreviewProps {
  file: FileWithUrl;
  src: string;
}

const CATEGORY_ICONS: Record<FileCategory, LucideIcon> = {
  images: FileImage,
  documents: FileText,
  video: FileVideo,
  audio: FileMusic,
  archives: FileArchive,
  code: FileCode,
  other: FileIcon,
};

// more than the few lines a card has room for
const TEXT_PREVIEW_BYTES = 2048;

const getFileExtension = (filename: string) => {
  return filename.split(".").pop()?.toUpperCase() || "";
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function TypeIcon({ name }: { name: string }) {
  const Icon = CATEGORY_ICONS[getFileCategory(name)];
  const extension = getFileExtension(name);

  return (
    <div className="relative">
      <Icon className="text-muted-foreground/60 group-hover:text-muted-foreground/80 h-12 w-12 transition-colors" />
      {extension && (
        <div className="bg-primary/90 text-primary-foreground absolute -right-2 -bottom-2 rounded-md px-1.5 py-0.5 text-xs font-medium shadow-sm">
          {extension}
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background/80 border-border/50 text-muted-foreground absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium shadow-sm backdrop-blur-sm">
      {children}
    </div>
  );
}

/** A page peeking up from the bottom edge, for documents. */
function Sheet({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-x-6 top-4 bottom-0 overflow-hidden rounded-t-md shadow-md ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Shows the type icon until the preview is ready, and again if it fails. */
function PreviewFrame({
  file,
  status,
  badge,
  children,
}: {
  file: FileWithUrl;
  status: Status;
  badge?: ReactNode;
  children: ReactNode;
}) {
  if (status === "failed") return <TypeIcon name={file.name} />;

  const label = badge ?? getFileExtension(file.name);

  return (
    <>
      {status === "loading" && <TypeIcon name={file.name} />}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          status === "loading" && "opacity-0",
        )}
      >
        {children}
      </div>
      {status === "loaded" && label && <Badge>{label}</Badge>}
    </>
  );
}

function ImagePreview({ file, src }: PreviewProps) {
  const [status, setStatus] = useState<Status>("loading");
  // cropping would cut into logos and blow up tiny icons
  const contain = /\.(svg|ico)$/i.test(file.name);

  return (
    <PreviewFrame file={file} status={status}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className={cn(
          "size-full",
          contain ? "object-contain p-4" : "object-cover",
        )}
      />
    </PreviewFrame>
  );
}

function VideoPreview({ file, src }: PreviewProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [duration, setDuration] = useState(0);

  return (
    <PreviewFrame
      file={file}
      status={status}
      badge={
        Number.isFinite(duration) && duration > 0 ? (
          <>
            <Play className="size-3 fill-current" />
            {formatDuration(duration)}
          </>
        ) : undefined
      }
    >
      <video
        // seeking past zero makes browsers paint a frame instead of nothing
        src={`${src}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        // an audio-only file has no frame to show
        onLoadedData={(e) =>
          setStatus(e.currentTarget.videoWidth > 0 ? "loaded" : "failed")
        }
        onError={() => setStatus("failed")}
        className="size-full object-cover"
      />
    </PreviewFrame>
  );
}

function PdfPreview({ file, src }: PreviewProps) {
  const [status, setStatus] = useState<Status>("loading");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = new AbortController();

    import("@/utils/pdf-thumbnail")
      .then(({ renderPdfThumbnail }) =>
        renderPdfThumbnail(src, canvas, controller.signal),
      )
      .then(
        () => setStatus("loaded"),
        () => {
          if (!controller.signal.aborted) setStatus("failed");
        },
      );

    return () => controller.abort();
  }, [src]);

  return (
    <PreviewFrame file={file} status={status}>
      <Sheet className="bg-white">
        <canvas ref={canvasRef} className="size-full" />
      </Sheet>
    </PreviewFrame>
  );
}

function TextPreview({ file, src }: PreviewProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [text, setText] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(src, {
      headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Unexpected ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        // `stream` holds back a multi-byte character the range cut in half
        const content = new TextDecoder().decode(
          buffer.slice(0, TEXT_PREVIEW_BYTES),
          { stream: true },
        );
        if (content.includes("\0")) throw new Error("Binary content");

        setText(content);
        setStatus("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("failed");
      });

    return () => controller.abort();
  }, [src]);

  return (
    <PreviewFrame file={file} status={status}>
      <Sheet className="bg-background">
        <pre className="text-muted-foreground p-3 font-mono text-[10px] leading-relaxed wrap-break-word whitespace-pre-wrap">
          {text}
        </pre>
      </Sheet>
    </PreviewFrame>
  );
}

function AudioPreview({ file, src }: PreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) return <TypeIcon name={file.name} />;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    // one card plays at a time
    for (const other of document.querySelectorAll("audio")) {
      if (other !== audio) other.pause();
    }
    // an unplayable source also fires `error`, which swaps in the icon
    audio.play().catch(() => {});
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setProgress(0)}
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget;
          setProgress(duration > 0 ? currentTime / duration : 0);
        }}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={`${playing ? "Pause" : "Play"} ${file.name}`}
        className="bg-primary text-primary-foreground relative z-10 flex size-12 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
      >
        {playing ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="size-5 translate-x-px fill-current" />
        )}
      </button>

      <Badge>{getFileExtension(file.name)}</Badge>

      {progress > 0 && (
        <div className="bg-primary/20 absolute inset-x-0 bottom-0 h-1">
          <div
            className="bg-primary h-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </>
  );
}

const PREVIEWS: Record<PreviewKind, (props: PreviewProps) => ReactNode> = {
  image: ImagePreview,
  video: VideoPreview,
  audio: AudioPreview,
  pdf: PdfPreview,
  text: TextPreview,
};

export default function FilePreview({ file }: { file: FileWithUrl }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const kind = file.size > 0 ? getPreviewKind(file.name, file.mimeType) : null;
  const Preview = kind && inView ? PREVIEWS[kind] : null;

  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-center justify-center"
    >
      {Preview ? (
        // `file.url` has no leading slash; keyed so a rename starts fresh
        <Preview key={file.url} file={file} src={`/${file.url}`} />
      ) : (
        <TypeIcon name={file.name} />
      )}
    </div>
  );
}
