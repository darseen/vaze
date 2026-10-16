import type { File } from "@darseen/vaze";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ListGroup, Separator } from "heroui-native";
import { Check } from "lucide-react-native";
import { Fragment } from "react";
import { Text } from "react-native";
import {
  FILE_KINDS,
  fileKind,
  KIND_INFO,
  type FileKind,
} from "@/lib/file-kind";
import { Icon } from "../icon";
import { Sheet } from "../sheet";

const OPTIONS: { value: FileKind | null; label: string }[] = [
  { value: null, label: "All types" },
  ...FILE_KINDS.map((kind) => ({ value: kind, label: KIND_INFO[kind].label })),
];

type TypeSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  kind: FileKind | null;
  onKindChange: (kind: FileKind | null) => void;
};

export function TypeSheet({
  isOpen,
  onOpenChange,
  files,
  kind,
  onKindChange,
}: TypeSheetProps) {
  const counts = new Map<FileKind | null, number>([[null, files.length]]);
  for (const file of files) {
    const fileType = fileKind(file.name, file.mimeType);
    counts.set(fileType, (counts.get(fileType) ?? 0) + 1);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="File type"
      scrollable
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <ListGroup variant="secondary" className="mb-6">
          {OPTIONS.map((option, index) => (
            <Fragment key={option.label}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <ListGroup.Item
                onPress={() => {
                  onKindChange(option.value);
                  onOpenChange(false);
                }}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{option.label}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix className="flex-row items-center gap-3">
                  <Text className="font-normal text-sm text-muted">
                    {counts.get(option.value) ?? 0}
                  </Text>
                  <Icon
                    icon={Check}
                    size={18}
                    className={
                      option.value === kind
                        ? "text-accent-soft-foreground"
                        : "text-transparent"
                    }
                  />
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            </Fragment>
          ))}
        </ListGroup>
      </BottomSheetScrollView>
    </Sheet>
  );
}
