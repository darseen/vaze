import type Vaze from "@darseen/vaze";
import type { File, FileReference } from "@darseen/vaze";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File as DeviceFile, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

/** Downloads a file into the cache and opens the system share sheet for it. */
export async function shareFile(vaze: Vaze, file: File) {
  const folder = new Directory(Paths.cache, "shared");
  folder.create({ intermediates: true, idempotent: true });

  const downloaded = await DeviceFile.downloadFileAsync(
    vaze.files.downloadUrl(file.id),
    new DeviceFile(folder, file.name),
    { headers: await vaze.authHeaders(), idempotent: true },
  );

  await Sharing.shareAsync(downloaded.uri, {
    mimeType: file.mimeType,
    dialogTitle: file.name,
  });
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
