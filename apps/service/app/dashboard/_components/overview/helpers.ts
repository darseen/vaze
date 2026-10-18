import type { FileCategory } from "@/utils/file-type";
import type { File } from "@repo/types";
import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react";

/** Opens the file in the viewer on its folder's page. */
export function fileHref(file: Pick<File, "id" | "key">) {
  const slash = file.key.lastIndexOf("/");
  const folder =
    slash === -1
      ? ""
      : `/${file.key.slice(0, slash).split("/").map(encodeURIComponent).join("/")}`;
  return `/dashboard/files${folder}?file=${encodeURIComponent(file.id)}`;
}

/** The folder a file sits in, as the dashboard names it. */
export function folderOf(key: string) {
  const slash = key.lastIndexOf("/");
  return slash === -1 ? "All files" : key.slice(0, slash);
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** A UTC `YYYY-MM-DD` day, read in UTC so it never shifts a day. */
export function formatDay(date: string, style: "short" | "weekday" = "short") {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(
    "en-US",
    style === "weekday"
      ? { weekday: "short", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" },
  );
}

export const CATEGORY_ICONS: Record<FileCategory, LucideIcon> = {
  images: FileImage,
  documents: FileText,
  video: FileVideo,
  audio: FileAudio,
  archives: FileArchive,
  code: FileCode,
  other: FileIcon,
};

export const CATEGORY_BARS: Record<FileCategory, string> = {
  images: "bg-kind-images",
  documents: "bg-kind-documents",
  video: "bg-kind-video",
  audio: "bg-kind-audio",
  archives: "bg-kind-archives",
  code: "bg-kind-code",
  other: "bg-muted-foreground/40",
};
