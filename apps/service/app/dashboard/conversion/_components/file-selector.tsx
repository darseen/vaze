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
import { Check, ChevronRight, FileIcon, FolderIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: FileWithUrl) => void;
  /** Hides files that don't pass. Must be stable, e.g. defined at module level. */
  accept?: (file: FileWithUrl) => boolean;
}

type Listing =
  | {
      key: string;
      folders: Folder[];
      files: FileWithUrl[];
      /** Whether `accept` hid any files. */
      filtered: boolean;
      failed: false;
    }
  | { key: string; failed: true };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

export default function FileSelector({
  open,
  onOpenChange,
  onSelect,
  accept,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <Picker
          accept={accept}
          onSelect={onSelect}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Picker({
  accept,
  onSelect,
  onClose,
}: {
  accept?: (file: FileWithUrl) => boolean;
  onSelect: (file: FileWithUrl) => void;
  onClose: () => void;
}) {
  const [currentKey, setCurrentKey] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [selected, setSelected] = useState<FileWithUrl | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ key: currentKey });

    fetch(`/api/folders?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const {
          data,
          error,
        }: ApiResponse<{
          files: FileWithUrl[];
          folders: Folder[];
        }> = await response.json();
        if (error) throw new Error(error.message);

        const files = accept ? data.files.filter(accept) : data.files;
        setListing({
          key: currentKey,
          folders: [...data.folders].sort(byName),
          files: [...files].sort(byName),
          filtered: files.length < data.files.length,
          failed: false,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setListing({ key: currentKey, failed: true });
        }
      });

    return () => controller.abort();
  }, [currentKey, accept]);

  const loading = listing?.key !== currentKey;
  const segments = currentKey ? currentKey.split("/") : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">Choose from Vaze</DialogTitle>
        <DialogDescription>
          Open a folder to look inside, then pick a file.
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
                        onClick={() => setCurrentKey(key)}
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
        ) : listing.folders.length === 0 && listing.files.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            {listing.filtered
              ? "No matching files in this folder."
              : "This folder is empty."}
          </p>
        ) : (
          <>
            {listing.folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setCurrentKey(folder.key)}
                className="hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2"
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
                  onClick={() => setSelected(file)}
                  onDoubleClick={() => onSelect(file)}
                  className={cn(
                    "hover:bg-accent focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-left text-sm outline-none focus-visible:ring-2",
                    isSelected && "bg-accent",
                  )}
                >
                  <FileIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
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

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
        >
          Choose
        </Button>
      </DialogFooter>
    </>
  );
}
