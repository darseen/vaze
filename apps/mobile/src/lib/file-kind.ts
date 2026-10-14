import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react-native";

export type FileKind =
  "image" | "video" | "audio" | "document" | "archive" | "code" | "other";

const ARCHIVES = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"];
const CODE = [
  "js",
  "ts",
  "jsx",
  "tsx",
  "json",
  "html",
  "css",
  "py",
  "go",
  "rs",
  "sh",
  "yml",
  "yaml",
  "xml",
  "sql",
];
const DOCUMENTS = [
  "pdf",
  "txt",
  "md",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "rtf",
  "odt",
];

export function fileKind(name: string, mimeType: string): FileKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ARCHIVES.includes(ext) || /zip|compressed|tar/.test(mimeType))
    return "archive";
  if (CODE.includes(ext)) return "code";
  if (
    DOCUMENTS.includes(ext) ||
    mimeType.startsWith("text/") ||
    mimeType === "application/pdf"
  ) {
    return "document";
  }
  return "other";
}

export const KIND_INFO: Record<
  FileKind,
  { label: string; noun: string; icon: LucideIcon; tint: string; bar: string }
> = {
  image: {
    label: "Images",
    noun: "Image",
    icon: FileImage,
    tint: "text-sky-500",
    bar: "bg-sky-500",
  },
  video: {
    label: "Videos",
    noun: "Video",
    icon: FileVideo,
    tint: "text-violet-500",
    bar: "bg-violet-500",
  },
  audio: {
    label: "Audio",
    noun: "Audio",
    icon: FileAudio,
    tint: "text-pink-500",
    bar: "bg-pink-500",
  },
  document: {
    label: "Documents",
    noun: "Document",
    icon: FileText,
    tint: "text-emerald-500",
    bar: "bg-emerald-500",
  },
  archive: {
    label: "Archives",
    noun: "Archive",
    icon: FileArchive,
    tint: "text-orange-500",
    bar: "bg-orange-500",
  },
  code: {
    label: "Code",
    noun: "Code",
    icon: FileCode,
    tint: "text-teal-500",
    bar: "bg-teal-500",
  },
  other: {
    label: "Other",
    noun: "File",
    icon: File,
    tint: "text-muted",
    bar: "bg-muted",
  },
};
