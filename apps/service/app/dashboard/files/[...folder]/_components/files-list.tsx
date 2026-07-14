"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { FileWithUrl, Folder } from "@repo/types";
import { ArrowDownAZ, ArrowUpAZ, FileIcon, FolderIcon, Search } from "lucide-react";
import { useMemo, useState } from "react";
import Breadcrumb from "./breadcrumb";
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

export default function FilesList({ files, folders }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FileCategory | "all">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  const hasContent = files.length > 0 || folders.length > 0;
  const hasResults = visibleFiles.length > 0 || visibleFolders.length > 0;

  return (
    <section className="space-y-4">
      <Breadcrumb />

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
                sortDirection === "asc"
                  ? "Sort ascending"
                  : "Sort descending"
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
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </section>
  );
}
