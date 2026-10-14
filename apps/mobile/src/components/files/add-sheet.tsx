import { FileUp, FolderPlus, Images } from "lucide-react-native";
import { ActionGroup } from "../action-group";
import { Sheet } from "../sheet";

type AddSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPickMedia: () => void;
  onPickFiles: () => void;
  onNewFolder: () => void;
};

export function AddSheet({
  isOpen,
  onOpenChange,
  onPickMedia,
  onPickFiles,
  onNewFolder,
}: AddSheetProps) {
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Add to this folder"
    >
      <ActionGroup
        actions={[
          { label: "Photos and videos", icon: Images, onPress: onPickMedia },
          { label: "Files", icon: FileUp, onPress: onPickFiles },
          { label: "New folder", icon: FolderPlus, onPress: onNewFolder },
        ]}
      />
    </Sheet>
  );
}
