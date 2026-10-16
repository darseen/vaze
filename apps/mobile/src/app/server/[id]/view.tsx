import { useLocalSearchParams } from "expo-router";
import { FileViewer } from "@/components/viewer/file-viewer";

export default function ViewScreen() {
  const { folder, file } = useLocalSearchParams<{
    folder?: string;
    file: string;
  }>();
  return <FileViewer folderKey={folder ?? ""} fileId={file} />;
}
