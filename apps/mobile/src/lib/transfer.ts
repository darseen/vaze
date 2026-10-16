import type Vaze from "@darseen/vaze";
import type { File, FileReference, Folder } from "@darseen/vaze";
import * as DocumentPicker from "expo-document-picker";
import { fetch as streamingFetch } from "expo/fetch";
import {
  Directory,
  DownloadTask,
  File as DeviceFile,
  Paths,
} from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import SaveToDownloads from "../../modules/downloads";

export type DownloadRequest = {
  url: string;
  name: string;
  mimeType: string;
  /** Sent as a JSON POST body; without one the download is a GET. */
  body?: unknown;
};

export function fileDownload(vaze: Vaze, file: File): DownloadRequest {
  return {
    url: vaze.files.downloadUrl(file.id),
    name: file.name,
    mimeType: file.mimeType,
  };
}

export function folderDownload(vaze: Vaze, folder: Folder): DownloadRequest {
  return {
    url: vaze.folders.downloadUrl({ id: folder.id }),
    name: `${folder.name}.zip`,
    mimeType: "application/zip",
  };
}

async function failure(response: Response) {
  try {
    const { error } = (await response.json()) as {
      error?: { message?: string };
    };
    if (error?.message) return error.message;
  } catch {
    // not a JSON error body
  }
  return statusMessage(response.status);
}

function statusMessage(status: number) {
  if (status === 404) return "It's no longer on the server";
  if (status === 401) return "Your session ended. Sign in again";
  if (status === 403) return "Your account can't download it";
  return `The server answered ${status}`;
}

/** Streams a download into `destination` without holding it in memory. */
async function writeDownload(
  vaze: Vaze,
  request: DownloadRequest,
  destination: DeviceFile,
) {
  const headers = await vaze.authHeaders();

  if (request.body === undefined) {
    try {
      await new DownloadTask(request.url, destination, {
        headers,
      }).downloadAsync();
    } catch (error) {
      // the native error only carries the status, as "HTTP 404"
      const status = /HTTP (\d{3})/.exec(String(error))?.[1];
      throw status ? new Error(statusMessage(Number(status))) : error;
    }
    return;
  }

  const response = await streamingFetch(request.url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(request.body),
    credentials: "omit",
  });
  if (!response.ok || !response.body) throw new Error(await failure(response));
  await response.body.pipeTo(destination.writableStream());
}

/** Downloads into the cache and opens the system share sheet. */
export async function shareDownload(vaze: Vaze, request: DownloadRequest) {
  const folder = new Directory(Paths.cache, "shared");
  folder.create({ intermediates: true, idempotent: true });

  const destination = new DeviceFile(folder, request.name);
  if (destination.exists) destination.delete();
  await writeDownload(vaze, request, destination);

  await Sharing.shareAsync(destination.uri, {
    mimeType: request.mimeType,
    dialogTitle: request.name,
  });
}

export function shareFile(vaze: Vaze, file: File) {
  return shareDownload(vaze, fileDownload(vaze, file));
}

// Android 10 is the first that saves to Downloads without a permission
const Downloads =
  Platform.OS === "android" && Platform.Version >= 29 ? SaveToDownloads : null;

// one cache folder per save, so two files of one name never collide
let saveCount = 0;

/** Saves into the shared Downloads folder like a browser; resolves with the name it got there. */
export async function saveDownload(
  vaze: Vaze,
  request: DownloadRequest,
): Promise<string | null> {
  if (!Downloads) {
    // iOS, Android 9 and older builds save through the share sheet instead
    await shareDownload(vaze, request);
    return null;
  }

  const folder = new Directory(
    Paths.cache,
    "downloads",
    `${Date.now()}-${saveCount++}`,
  );
  folder.create({ intermediates: true, idempotent: true });
  const temporary = new DeviceFile(folder, request.name);

  try {
    await writeDownload(vaze, request, temporary);
    return await Downloads.save(temporary.uri, request.name, request.mimeType);
  } finally {
    folder.delete();
  }
}

function nameFromUri(uri: string) {
  return decodeURIComponent(uri.split("/").pop() ?? "file");
}

export async function pickMedia(): Promise<FileReference[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.fileName ?? nameFromUri(asset.uri),
    type: asset.mimeType ?? "application/octet-stream",
  }));
}

export async function pickDocuments(): Promise<FileReference[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? "application/octet-stream",
  }));
}
