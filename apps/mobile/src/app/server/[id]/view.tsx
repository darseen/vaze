import { useLocalSearchParams } from "expo-router";
import { FileViewer } from "@/components/viewer/file-viewer";
import { isFileKind } from "@/lib/file-kind";

export default function ViewScreen() {
  const { folder, file, q, type } = useLocalSearchParams<{
    folder?: string;
    file: string;
    q?: string;
    type?: string;
  }>();
  return (
    <FileViewer
      folderKey={folder ?? ""}
      fileId={file}
      query={q}
      kind={isFileKind(type) ? type : null}
    />
  );
}
