export const FILE_CATEGORIES = [
  "images",
  "documents",
  "video",
  "audio",
  "archives",
  "code",
  "other",
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

const EXTENSION_MAP: Record<string, FileCategory> = {
  // images
  jpg: "images",
  jpeg: "images",
  png: "images",
  gif: "images",
  webp: "images",
  svg: "images",
  bmp: "images",
  ico: "images",
  avif: "images",
  // documents
  txt: "documents",
  md: "documents",
  doc: "documents",
  docx: "documents",
  pdf: "documents",
  xls: "documents",
  xlsx: "documents",
  ppt: "documents",
  pptx: "documents",
  csv: "documents",
  // video
  mp4: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  webm: "video",
  // audio
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  m4a: "audio",
  // archives
  zip: "archives",
  rar: "archives",
  "7z": "archives",
  tar: "archives",
  gz: "archives",
  // code
  js: "code",
  ts: "code",
  jsx: "code",
  tsx: "code",
  json: "code",
  html: "code",
  css: "code",
  py: "code",
  go: "code",
  rs: "code",
  java: "code",
  sh: "code",
  yml: "code",
  yaml: "code",
};

/**
 * Classify a file into a broad category based on its extension. Used by the
 * dashboard type filter. Unknown/extensionless names fall back to "other".
 */
export function getFileCategory(name: string): FileCategory {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext || ext === name.toLowerCase()) return "other";
  return EXTENSION_MAP[ext] ?? "other";
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  images: "Images",
  documents: "Documents",
  video: "Video",
  audio: "Audio",
  archives: "Archives",
  code: "Code",
  other: "Other",
};
