import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils";
import { getPreviewKind } from "@/utils/file-type";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { FileWithUrl } from "@repo/types";
import { ChevronLeft, ChevronRight, Download, Lock, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import Filmstrip from "./filmstrip";
import { AudioPlayer, VideoPlayer } from "./media-player";
import PdfView from "./pdf-view";
import { Loading, NoPreview } from "./status";
import TextView from "./text-view";

interface Props {
  files: FileWithUrl[];
  /** -1 keeps the viewer closed. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

// a touch drag this far, and mostly sideways, moves to the next file
const SWIPE_DISTANCE = 60;

function ImageView({ file }: { file: FileWithUrl }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  // vectors scale up cleanly, while photos stay at their natural size or less
  const vector = /\.svg$/i.test(file.name);

  if (status === "failed") {
    return <NoPreview file={file} message="This image couldn't be loaded" />;
  }

  return (
    <div className="relative flex size-full items-center justify-center p-4">
      {status === "loading" && <Loading className="absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${file.url}`}
        alt={file.name}
        draggable={false}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className={cn(
          "object-contain transition-opacity duration-200 select-none",
          vector ? "size-full" : "max-h-full max-w-full",
          status === "loading" && "opacity-0",
        )}
      />
    </div>
  );
}

function FileContent({ file }: { file: FileWithUrl }) {
  if (file.size === 0) {
    return <NoPreview file={file} message="This file is empty" />;
  }

  switch (getPreviewKind(file.name, file.mimeType)) {
    case "image":
      return <ImageView file={file} />;
    case "video":
      return <VideoPlayer file={file} />;
    case "audio":
      return <AudioPlayer file={file} />;
    case "pdf":
      return <PdfView file={file} />;
    case "text":
      return <TextView file={file} />;
    default:
      return (
        <NoPreview file={file} message="No preview for this type of file" />
      );
  }
}

export default function FileViewer({
  files,
  index,
  onIndexChange,
  onClose,
}: Props) {
  const file = index === -1 ? undefined : files[index];
  const contentRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastFileId = useRef<string | null>(null);

  useEffect(() => {
    if (file) lastFileId.current = file.id;
  }, [file]);

  const go = (to: number) => {
    if (to >= 0 && to < files.length) onIndexChange(to);
  };

  // the images either side load in the background, so stepping is instant
  useEffect(() => {
    if (index === -1) return;

    for (const neighbor of [files[index - 1], files[index + 1]]) {
      if (
        neighbor &&
        neighbor.size > 0 &&
        getPreviewKind(neighbor.name, neighbor.mimeType) === "image"
      ) {
        new Image().src = `/${neighbor.url}`;
      }
    }
  }, [files, index]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // in fullscreen the video player takes the arrows to seek
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (document.fullscreenElement) return;

    if (event.key === "ArrowLeft") go(index - 1);
    else if (event.key === "ArrowRight") go(index + 1);
    else return;

    event.preventDefault();
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    swipe.current =
      event.pointerType === "touch" &&
      !target.closest("button, a, [role=slider]")
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) {
      return;
    }

    go(dx < 0 ? index + 1 : index - 1);
  };

  return (
    <Dialog
      open={file !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-neutral-950" />
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // focus the viewer itself, so the arrow keys work straight away
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            // with no trigger to return to, land on the card of the last file shown
            event.preventDefault();
            const id = lastFileId.current;
            if (!id) return;
            document
              .querySelector<HTMLElement>(`[data-file-id="${CSS.escape(id)}"]`)
              ?.focus();
          }}
          onEscapeKeyDown={(event) => {
            // Escape leaves fullscreen first
            if (document.fullscreenElement) event.preventDefault();
          }}
          onKeyDown={handleKeyDown}
          className="dark text-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 flex flex-col outline-none"
        >
          {file && (
            <>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-sm leading-normal font-medium">
                    {file.name}
                  </DialogTitle>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {files.length > 1 && (
                      <>
                        <span>
                          {index + 1} of {files.length}
                        </span>
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <span>{formatBytes(file.size)}</span>
                    {file.visibility === "private" && (
                      <>
                        <span aria-hidden>·</span>
                        <Lock className="size-3" />
                        <span>Private</span>
                      </>
                    )}
                  </p>
                </div>

                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={`/api/files/download/${file.id}`}
                    download
                    aria-label="Download"
                    title="Download"
                  >
                    <Download />
                  </a>
                </Button>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close"
                    title="Close (Esc)"
                  >
                    <X />
                  </Button>
                </DialogClose>
              </header>

              <div
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => {
                  swipe.current = null;
                }}
                className="relative min-h-0 flex-1 touch-pan-y touch-pinch-zoom"
              >
                <div className="absolute inset-0 sm:inset-x-16">
                  {/* keyed so each file starts with fresh state */}
                  <FileContent key={file.id} file={file} />
                </div>

                {index > 0 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => go(index - 1)}
                    aria-label="Previous file"
                    title="Previous (←)"
                    className="absolute top-1/2 left-2 z-10 size-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 backdrop-blur-sm hover:bg-black/70 sm:left-3"
                  >
                    <ChevronLeft className="size-6" />
                  </Button>
                )}
                {index < files.length - 1 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => go(index + 1)}
                    aria-label="Next file"
                    title="Next (→)"
                    className="absolute top-1/2 right-2 z-10 size-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 backdrop-blur-sm hover:bg-black/70 sm:right-3"
                  >
                    <ChevronRight className="size-6" />
                  </Button>
                )}
              </div>

              {files.length > 1 && (
                <Filmstrip files={files} index={index} onSelect={go} />
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
