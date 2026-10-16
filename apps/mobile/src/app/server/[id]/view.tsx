import { useLocalSearchParams } from "expo-router";
import { FileViewer } from "@/components/viewer/file-viewer";

export default function ViewScreen() {
  const { folder, file, q } = useLocalSearchParams<{
    folder?: string;
    file: string;
    q?: string;
  }>();
  return <FileViewer folderKey={folder ?? ""} fileId={file} query={q} />;
}
