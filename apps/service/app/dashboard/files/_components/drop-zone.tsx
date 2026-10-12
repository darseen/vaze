"use client";

import { useCan } from "@/app/dashboard/_components/permissions";
import { useUploadActions } from "@/app/dashboard/_components/uploads/provider";
import { Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import getFolderPath from "../_utils/get-folder-path";
import readDrop from "../_utils/read-drop";

/** A drag only counts as an upload when it actually carries files. */
function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/** Uploads only create folders that hold a file, so empty ones go separately. */
async function createEmptyFolders(paths: string[]) {
  let created = 0;
  let failed = 0;

  for (const folder of paths) {
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });

      // 409 means it is already there, which is what the drop asked for
      if (response.ok) created += 1;
      else if (response.status !== 409) failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { created, failed };
}

export default function DropZone({ children }: { children: ReactNode }) {
  const [isDragging, setIsDragging] = useState(false);

  const { enqueue } = useUploadActions();
  const router = useRouter();
  const pathname = usePathname();
  const folder = getFolderPath(pathname);
  const canUpload = useCan()("files:write");

  useEffect(() => {
    if (!canUpload) return;

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

      readDrop(event.dataTransfer)
        .then(async ({ items, emptyFolders, unreadable }) => {
          if (unreadable > 0) {
            toast.error(
              unreadable === 1
                ? "1 item couldn't be read"
                : `${unreadable} items couldn't be read`,
            );
          }

          enqueue(items, folder);

          const { created, failed } = await createEmptyFolders(
            emptyFolders.map((path) => (folder ? `${folder}/${path}` : path)),
          );

          if (failed > 0) {
            toast.error(
              failed === 1
                ? "Couldn't create an empty folder"
                : `Couldn't create ${failed} empty folders`,
            );
          }
          if (created > 0) router.refresh();
        })
        .catch(() => toast.error("Couldn't read the dropped items"));
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
  }, [enqueue, folder, canUpload, router]);

  return (
    <div className="relative mx-auto min-h-full w-full max-w-7xl">
      {children}

      {isDragging && (
        <div className="border-primary/60 bg-background/70 pointer-events-none absolute -inset-2 z-40 rounded-xl border-2 border-dashed backdrop-blur-[1px]">
          <div className="sticky top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 text-center">
            <Upload className="text-primary size-8" />
            <p className="text-foreground text-sm font-semibold">
              Drop files or folders to upload
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
