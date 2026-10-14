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
  { label: string; noun: string; icon: LucideIcon; bar: string }
> = {
  image: {
    label: "Images",
    noun: "Image",
    icon: FileImage,
    bar: "bg-kind-image",
  },
  video: {
    label: "Videos",
    noun: "Video",
    icon: FileVideo,
    bar: "bg-kind-video",
  },
  audio: {
    label: "Audio",
    noun: "Audio",
    icon: FileAudio,
    bar: "bg-kind-audio",
  },
  document: {
    label: "Documents",
    noun: "Document",
    icon: FileText,
    bar: "bg-kind-document",
  },
  archive: {
    label: "Archives",
    noun: "Archive",
    icon: FileArchive,
    bar: "bg-kind-archive",
  },
  code: {
    label: "Code",
    noun: "Code",
    icon: FileCode,
    bar: "bg-kind-code",
  },
  other: {
    label: "Other",
    noun: "File",
    icon: File,
    bar: "bg-muted",
  },
};
