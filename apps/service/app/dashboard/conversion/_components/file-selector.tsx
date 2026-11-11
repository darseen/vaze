"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ApiResponse, FileWithUrl, Folder } from "@repo/types";
import {
  Check,
  ChevronRight,
  FileIcon,
  FolderIcon,
  Loader2,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hide files that don't pass, e.g. `(file) => /\.(mp4|mov|mkv|webm)$/i.test(file.name)`. */
  accept?: (file: FileWithUrl) => boolean;
}

type Listing =
  | { key: string; folders: Folder[]; files: FileWithUrl[]; failed: false }
  | { key: string; folders: null; files: null; failed: true };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

const toMp3Name = (name: string) =>
  `${name.replace(/\.[^./\\]+$/, "") || "audio"}.mp3`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function FileSelector({ open, onOpenChange, accept }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <Picker accept={accept} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Picker({
  accept,
  onClose,
}: {
  accept?: (file: FileWithUrl) => boolean;
  onClose: () => void;
}) {
  const [currentKey, setCurrentKey] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [selected, setSelected] = useState<FileWithUrl | null>(null);
  const [converting, setConverting] = useState(false);
  const conversionRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load<T>(url: string) {
      const response = await fetch(url, { signal });
      const { data, error }: ApiResponse<T> = await response.json();
      if (error) throw new Error(error.message);
      return data;
    }
    const foldersParams = new URLSearchParams({ key: currentKey });

    load<{
      files: FileWithUrl[];
      folders: Folder[];
    }>(`/api/folders?${foldersParams}`)
      .then(({ files, folders }) => {
        setListing({
          key: currentKey,
          folders: [...folders].sort(byName),
          files: (accept ? files.filter(accept) : [...files]).sort(byName),
          failed: false,
        });
      })
      .catch(() => {
        if (!signal.aborted) {
          setListing({
            key: currentKey,
            folders: null,
            files: null,
            failed: true,
          });
        }
      });

    return () => controller.abort();
  }, [currentKey, accept]);

  // Closing the dialog unmounts this component. Aborting the request makes the
  // server notice the disconnect and kill the ffmpeg process.
  useEffect(() => {
    return () => conversionRef.current?.abort();
  }, []);

  const loading = listing?.key !== currentKey;
  const segments = currentKey ? currentKey.split("/") : [];

  const pick = (file: FileWithUrl) => setSelected(file);

  const handleConversion = async () => {
    if (!selected) return toast.error("You must select a file!");

    const controller = new AbortController();
    conversionRef.current = controller;
    setConverting(true);

    try {
      const response = await fetch("/api/conversion/video-to-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: selected.id }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to convert file!");
        return;
      }

      // Resolves once the server has streamed the whole MP3, i.e. when the
      // conversion is finished. If ffmpeg dies mid-way the stream errors and
      // this throws instead of handing back a truncated file.
      const audio = await response.blob();
      downloadBlob(audio, toMp3Name(selected.name));
      toast.success("Audio ready. Your download has started.");
      onClose();
    } catch {
      if (!controller.signal.aborted) toast.error("Failed to convert file!");
    } finally {
      if (conversionRef.current === controller) conversionRef.current = null;
      setConverting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6 text-lg">
          Convert video to audio
        </DialogTitle>
        <DialogDescription>
          Pick a video, then convert it to an MP3. Open a folder to look inside
        </DialogDescription>
      </DialogHeader>

      <Breadcrumb>
        <BreadcrumbList className="gap-1 sm:gap-1.5">
          {["Files", ...segments].map((label, index) => {
            const key = segments.slice(0, index).join("/");
            const last = index === segments.length;

            return (
              <Fragment key={key || "/"}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className="min-w-0">
                  {last ? (
                    <BreadcrumbPage className="truncate font-medium">
                      {label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        type="button"
                        disabled={converting}
                        onClick={() => setCurrentKey(key)}
                        className="max-w-32 cursor-pointer truncate disabled:cursor-default"
                      >
                        {label}
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div
        aria-busy={converting}
        className={cn(
          "h-64 overflow-y-auto rounded-md border p-1 transition-opacity",
          converting && "opacity-60",
        )}
      >
        {loading ? (
          <div className="space-y-1 p-1">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-9 w-full" />
            ))}
          </div>
        ) : listing.failed ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            This folder could not be loaded.
          </p>
        ) : listing.folders.length === 0 && listing.files.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            This folder is empty.
          </p>
        ) : (
          <>
            {listing.folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                disabled={converting}
                onClick={() => setCurrentKey(folder.key)}
                className="hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <FolderIcon className="size-4 shrink-0 fill-current text-blue-500" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            ))}

            {listing.files.map((file) => {
              const isSelected = selected?.id === file.id;

              return (
                <button
                  key={file.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={converting}
                  onClick={() => pick(file)}
                  className={cn(
                    "hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent",
                    isSelected && "bg-accent",
                  )}
                >
                  <FileIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center border",
                      "rounded-full",
                      isSelected &&
                        "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {converting && (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span className="min-w-0 truncate">
            Converting {selected?.name}. Long videos can take a while.
          </span>
        </p>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleConversion} disabled={!selected || converting}>
          {converting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Converting…
            </>
          ) : (
            "Convert to MP3"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
