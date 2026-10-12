import type { UploadItem } from "@/app/dashboard/_components/uploads/provider";

export interface DroppedContents {
  items: UploadItem[];
  /** Folders with nothing inside, which no file upload would create. */
  emptyFolders: string[];
  /** Entries the browser refused to read, such as a file removed mid-drop. */
  unreadable: number;
}

function isFile(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectory(
  entry: FileSystemEntry,
): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function fileOf(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject));
}

/** `readEntries` returns a directory in batches, ending with an empty one. */
async function readAllEntries(directory: FileSystemDirectoryEntry) {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = [];

  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
}

async function walk(
  entry: FileSystemEntry,
  dir: string,
  contents: DroppedContents,
): Promise<void> {
  if (isFile(entry)) {
    try {
      contents.items.push({ file: await fileOf(entry), dir });
    } catch {
      contents.unreadable += 1;
    }
    return;
  }

  if (!isDirectory(entry)) return;

  const path = dir ? `${dir}/${entry.name}` : entry.name;

  let children: FileSystemEntry[];
  try {
    children = await readAllEntries(entry);
  } catch {
    contents.unreadable += 1;
    return;
  }

  if (children.length === 0) contents.emptyFolders.push(path);
  await Promise.all(children.map((child) => walk(child, path, contents)));
}

/** Every file in a drop, with dropped folders expanded into their contents. */
export default async function readDrop(
  dataTransfer: DataTransfer,
): Promise<DroppedContents> {
  const contents: DroppedContents = {
    items: [],
    emptyFolders: [],
    unreadable: 0,
  };

  const items = Array.from(dataTransfer.items ?? []).filter(
    (item) => item.kind === "file",
  );

  if (items.length === 0 || typeof items[0].webkitGetAsEntry !== "function") {
    contents.items = Array.from(dataTransfer.files, (file) => ({
      file,
      dir: "",
    }));
    return contents;
  }

  // entries must be taken before the first await: the drop data is gone after
  const entries = items.map((item) => item.webkitGetAsEntry());

  await Promise.all(
    entries.map(async (entry) => {
      if (entry) await walk(entry, "", contents);
      else contents.unreadable += 1;
    }),
  );

  return contents;
}
