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
import type { ApiResponse, FileWithUrl, Folder } from "@repo/types";
import { ChevronRight, FolderIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";

/** One folder, or files that all live in the same folder. */
export type MoveTarget = { folder: Folder } | { files: FileWithUrl[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MoveTarget;
  onMoved?: () => void;
}

type Listing =
  | { key: string; folders: Folder[]; failed: false }
  | { key: string; folders: null; failed: true };

const parentKeyOf = (key: string) =>
  key.slice(0, Math.max(key.lastIndexOf("/"), 0));

const folderHref = (key: string) =>
  key
    ? `/dashboard/files/${key.split("/").map(encodeURIComponent).join("/")}`
    : "/dashboard/files";

export default function MoveDialog({
  open,
  onOpenChange,
  target,
  onMoved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <FolderPicker
          target={target}
          onClose={() => onOpenChange(false)}
          onMoved={onMoved}
        />
      </DialogContent>
    </Dialog>
  );
}

function FolderPicker({
  target: initialTarget,
  onClose,
  onMoved,
}: {
  target: MoveTarget;
  onClose: () => void;
  onMoved?: () => void;
}) {
  // frozen on open, so a selection cleared mid-close can't empty the dialog
  const [target] = useState(initialTarget);
  const movingFolder = "folder" in target ? target.folder : null;
  const files = "files" in target ? target.files : [];
  const sourceKey = parentKeyOf(movingFolder?.key ?? files[0]?.key ?? "");

  const [currentKey, setCurrentKey] = useState(sourceKey);
  const [listing, setListing] = useState<Listing | null>(null);
  const [moving, setMoving] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ key: currentKey, limit: "0" });

    fetch(`/api/folders?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then(({ data, error }: ApiResponse<{ folders: Folder[] }>) => {
        if (error) throw new Error(error.message);
        setListing({
          key: currentKey,
          folders: [...data.folders].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
          failed: false,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setListing({ key: currentKey, folders: null, failed: true });
        }
      });

    return () => controller.abort();
  }, [currentKey]);

  const loading = listing?.key !== currentKey;
  const segments = currentKey ? currentKey.split("/") : [];
  const destinationName = segments.at(-1) ?? "Files";

  const title = movingFolder
    ? `Move "${movingFolder.name}"`
    : files.length === 1
      ? `Move "${files[0].name}"`
      : `Move ${files.length} files`;

  const handleMove = async () => {
    const url = movingFolder ? "/api/folders/move" : "/api/files/move";
    const source = movingFolder
      ? { id: movingFolder.id }
      : files.length === 1
        ? { id: files[0].id }
        : { ids: files.map((file) => file.id) };

    const openDestination = {
      label: "Open",
      onClick: () => router.push(folderHref(currentKey)),
    };

    try {
      setMoving(true);
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ ...source, folder: currentKey }),
      });
      const { data, error } = (await response.json()) as ApiResponse<{
        files?: FileWithUrl[];
        failed?: { id: string; message: string }[];
      }>;

      // stay open on a refusal, so another folder can be picked
      if (error) return toast.error(error.message);

      const failed = data.failed ?? [];
      const movedCount = data.files?.length ?? 0;

      if (failed.length > 0 && movedCount === 0) {
        return toast.error(failed[0].message);
      }

      if (failed.length > 0) {
        toast.warning(`Moved ${movedCount} of ${files.length} files`, {
          description:
            failed.length === 1
              ? failed[0].message
              : `${failed.length} could not be moved`,
          action: openDestination,
        });
      } else {
        const what = movingFolder
          ? "Folder"
          : files.length === 1
            ? "File"
            : `${files.length} files`;
        toast.success(`${what} moved to ${destinationName}`, {
          action: openDestination,
        });
      }

      onMoved?.();
      onClose();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setMoving(false);
      router.refresh();
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6 text-lg">{title}</DialogTitle>
        <DialogDescription>Pick the folder to move into.</DialogDescription>
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
                        onClick={() => setCurrentKey(key)}
                        disabled={moving}
                        className="max-w-32 cursor-pointer truncate"
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

      <div className="h-64 overflow-y-auto rounded-md border p-1">
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
        ) : listing.folders.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No subfolders here.
          </p>
        ) : (
          listing.folders.map((folder) => {
            // a folder can't be moved into itself or anything below it
            const isMoving = folder.id === movingFolder?.id;

            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => setCurrentKey(folder.key)}
                disabled={isMoving || moving}
                title={isMoving ? "The folder being moved" : undefined}
                className="hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <FolderIcon className="size-4 shrink-0 fill-current text-blue-500" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                {!isMoving && (
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={moving}>
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          disabled={
            moving || loading || listing.failed || currentKey === sourceKey
          }
        >
          {moving ? "Moving..." : "Move here"}
        </Button>
      </DialogFooter>
    </>
  );
}
