"use client";

import { useUploadActions } from "@/app/dashboard/_components/uploads/provider";
import { Upload } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import getFolderPath from "../_utils/get-folder-path";

/** A drag only counts as an upload when it actually carries files. */
function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * Pull the dropped files out, skipping directories — `dataTransfer.files`
 * reports a dropped folder as an empty file, which would upload as garbage.
 */
function droppedFiles(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []).filter(
    (item) => item.kind === "file",
  );

  if (items.length === 0 || typeof items[0].webkitGetAsEntry !== "function") {
    return { files: Array.from(dataTransfer.files), skipped: 0 };
  }

  const files: File[] = [];
  let skipped = 0;

  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    const file = item.getAsFile();

    if (entry?.isDirectory || !file) skipped += 1;
    else files.push(file);
  }

  return { files, skipped };
}

export default function DropZone({ children }: { children: ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);

  const { enqueue } = useUploadActions();
  const pathname = usePathname();
  const folder = getFolderPath(pathname);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      // without this the browser opens the file instead of dropping it
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    };

    const onDragLeave = (event: DragEvent) => {
      // a null relatedTarget means the pointer left the window entirely
      if (event.relatedTarget === null) setIsDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setIsDragging(false);

      if (!event.dataTransfer) return;
      const { files, skipped } = droppedFiles(event.dataTransfer);

      if (skipped > 0) {
        toast.error(
          skipped === 1
            ? "Folders can't be uploaded"
            : `${skipped} folders were skipped`,
        );
      }

      enqueue(files, folder);
    };

    const onDragEnd = () => setIsDragging(false);

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [enqueue, folder]);

  return (
    <div className="relative mx-auto min-h-full w-full max-w-7xl">
      {children}

      {isDragging && (
        <div className="border-primary/60 bg-background/70 pointer-events-none absolute -inset-2 z-40 rounded-xl border-2 border-dashed backdrop-blur-[1px]">
          <div className="sticky top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 text-center">
            <Upload className="text-primary size-8" />
            <p className="text-foreground text-sm font-semibold">
              Drop files to upload
            </p>
            <p className="text-muted-foreground text-xs">
              {folder ? `Into "${folder}"` : "Into your root folder"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
