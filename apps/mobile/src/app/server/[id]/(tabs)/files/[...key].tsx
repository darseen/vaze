import { useLocalSearchParams } from "expo-router";
import { FolderBrowser } from "@/components/files/folder-browser";

export default function FolderScreen() {
  const { key } = useLocalSearchParams<{ key: string[] }>();
  const segments = Array.isArray(key) ? key : [key];
  return <FolderBrowser folderKey={segments.join("/")} />;
}
