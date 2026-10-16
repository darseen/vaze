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

/** The kinds in the web's type filter order. */
export const FILE_KINDS: FileKind[] = [
  "image",
  "document",
  "video",
  "audio",
  "archive",
  "code",
  "other",
];

export function isFileKind(value: unknown): value is FileKind {
  return FILE_KINDS.includes(value as FileKind);
}

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

// the web dashboard's image extensions, which the server also thumbnails
const IMAGES = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
];

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text";

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** How a file is previewed and viewed, or null when it can't be, like the web. */
export function previewKind(file: {
  name: string;
  mimeType: string;
  size: number;
}): PreviewKind | null {
  if (file.size === 0) return null;

  // the extension wins: mime types misfile code (`.ts` is MPEG-TS video)
  const ext = extensionOf(file.name);
  if (CODE.includes(ext)) return "text";
  if (IMAGES.includes(ext)) return "image";

  const { mimeType } = file;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}

export function fileKind(name: string, mimeType: string): FileKind {
  const ext = extensionOf(name);
  // like `previewKind`, a code extension beats a misfiled mime type
  if (CODE.includes(ext)) return "code";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  if (ARCHIVES.includes(ext) || /zip|compressed|tar/.test(mimeType))
    return "archive";
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
