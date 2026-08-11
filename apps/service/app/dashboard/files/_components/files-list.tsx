"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseTimestamp } from "@/utils";
import {
  CATEGORY_LABELS,
  FILE_CATEGORIES,
  getFileCategory,
  type FileCategory,
} from "@/utils/file-type";
import type { ApiResponse, FileWithUrl, Folder } from "@repo/types";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  FileIcon,
  FolderIcon,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import FileCard from "./file-card";
import FolderCard from "./folder-card";

interface Props {
  files: FileWithUrl[];
  folders: Folder[];
}

type SortField = "name" | "size" | "createdAt";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortField, string> = {
  name: "Name",
  size: "Size",
  createdAt: "Date",
};

const fileWord = (count: number) => (count === 1 ? "file" : "files");

export default function FilesList({ files, folders }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FileCategory | "all">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // index of the last checkbox clicked, anchoring shift-click ranges
  const lastToggledIndex = useRef<number | null>(null);

  const router = useRouter();
  const query = search.trim().toLowerCase();

  const visibleFolders = useMemo(() => {
    const filtered = folders.filter((folder) =>
      folder.name.toLowerCase().includes(query),
    );

    return [...filtered].sort((a, b) => {
      // Folders have no size; fall back to name when sorting by size.
      const dir = sortDirection === "asc" ? 1 : -1;
      if (sortField === "createdAt") {
        return (
          dir *
          (parseTimestamp(a.createdAt).getTime() -
            parseTimestamp(b.createdAt).getTime())
        );
      }
      return dir * a.name.localeCompare(b.name);
    });
  }, [folders, query, sortField, sortDirection]);

  const visibleFiles = useMemo(() => {
    const filtered = files.filter((file) => {
      const matchesQuery = file.name.toLowerCase().includes(query);
      const matchesCategory =
        category === "all" || getFileCategory(file.name) === category;
      return matchesQuery && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "size":
          return dir * (a.size - b.size);
        case "createdAt":
          return (
            dir *
            (parseTimestamp(a.createdAt).getTime() -
              parseTimestamp(b.createdAt).getTime())
          );
      }
    });
  }, [files, query, category, sortField, sortDirection]);

  // only ever act on files the current search/filter actually shows, so a
  // hidden selection can never be deleted by mistake
  const selectedFiles = useMemo(
    () => visibleFiles.filter((file) => selected.has(file.id)),
    [visibleFiles, selected],
  );

  const allVisibleSelected =
    visibleFiles.length > 0 && selectedFiles.length === visibleFiles.length;

  const toggleSelected = (
    file: FileWithUrl,
    checked: boolean,
    shift: boolean,
  ) => {
    const index = visibleFiles.findIndex((visible) => visible.id === file.id);

    setSelected((current) => {
      const next = new Set(current);
      const anchor = lastToggledIndex.current;

      // shift-click fills in every file between the previous click and this one
      const range =
        shift && anchor !== null && anchor !== -1 && index !== -1
          ? visibleFiles.slice(
              Math.min(anchor, index),
              Math.max(anchor, index) + 1,
            )
          : [file];

      for (const target of range) {
        if (checked) next.add(target.id);
        else next.delete(target.id);
      }

      return next;
    });

    lastToggledIndex.current = index;
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const file of visibleFiles) {
        if (checked) next.add(file.id);
        else next.delete(file.id);
      }
      return next;
    });
    lastToggledIndex.current = null;
  };

  const clearSelection = () => {
    setSelected(new Set());
    lastToggledIndex.current = null;
  };

  const handleDeleteSelected = async () => {
    const ids = selectedFiles.map((file) => file.id);
    if (ids.length === 0) return;

    try {
      setDeleting(true);
      const response = await fetch("/api/files", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });

      const { data, error } = (await response.json()) as ApiResponse<{
        deleted: string[];
        failed: { id: string; message: string }[];
      }>;

      if (error) return toast.error(error.message);

      if (data.failed.length > 0) {
        toast.warning(
          `Deleted ${data.deleted.length} of ${ids.length} ${fileWord(ids.length)}`,
          { description: `${data.failed.length} could not be deleted` },
        );
      } else {
        toast.success(
          `Deleted ${data.deleted.length} ${fileWord(data.deleted.length)}`,
        );
      }

      clearSelection();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
      router.refresh();
    }
  };

  const hasContent = files.length > 0 || folders.length > 0;
  const hasResults = visibleFiles.length > 0 || visibleFolders.length > 0;

  return (
    <section className="space-y-4">
      {/* Search / filter / sort toolbar */}
      {hasContent && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files and folders"
              className="pl-9"
            />
          </div>

          <Select
            value={category}
            onValueChange={(value) =>
              setCategory(value as FileCategory | "all")
            }
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {FILE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Select
              value={sortField}
              onValueChange={(value) => setSortField(value as SortField)}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortField[]).map((field) => (
                  <SelectItem key={field} value={field}>
                    {SORT_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"))
              }
              aria-label={
                sortDirection === "asc" ? "Sort ascending" : "Sort descending"
              }
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
            >
              {sortDirection === "asc" ? (
                <ArrowUpAZ className="size-4" />
              ) : (
                <ArrowDownAZ className="size-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk selection toolbar */}
      {visibleFiles.length > 0 && (
        <div className="bg-muted/40 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={(checked) => toggleSelectAll(checked === true)}
              aria-label="Select all files"
            />
            Select all
          </label>

          {selectedFiles.length > 0 && (
            <span className="text-muted-foreground text-sm">
              {selectedFiles.length} {fileWord(selectedFiles.length)} selected
            </span>
          )}

          {selectedFiles.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* File/Folder Count Badges */}
      {hasResults && (
        <div className="flex flex-wrap gap-2">
          {visibleFolders.length > 0 && (
            <Badge
              variant="secondary"
              className="border-blue-200 bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
            >
              <FolderIcon className="mr-1 h-3 w-3" />
              {visibleFolders.length === 1
                ? "1 folder"
                : `${visibleFolders.length} folders`}
            </Badge>
          )}

          {visibleFiles.length > 0 && (
            <Badge
              variant="secondary"
              className="border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
            >
              <FileIcon className="mr-1 h-3 w-3" />
              {visibleFiles.length === 1
                ? "1 file"
                : `${visibleFiles.length} files`}
            </Badge>
          )}
        </div>
      )}

      {!hasContent ? (
        <div className="py-12 text-center">
          <FileIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-medium">
            No files found
          </h3>
          <p className="text-muted-foreground">
            Upload your first file to get started
          </p>
        </div>
      ) : !hasResults ? (
        <div className="py-12 text-center">
          <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="text-foreground mb-2 text-lg font-medium">
            No matching results
          </h3>
          <p className="text-muted-foreground">
            Try a different search or filter
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleFolders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}

          {visibleFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selected={selected.has(file.id)}
              onSelectedChange={(checked, shiftKey) =>
                toggleSelected(file, checked, shiftKey)
              }
            />
          ))}
        </div>
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedFiles.length} {fileWord(selectedFiles.length)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected{" "}
              {fileWord(selectedFiles.length)} will be permanently removed from
              your storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // keep the dialog up while the request is in flight
                e.preventDefault();
                handleDeleteSelected();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
