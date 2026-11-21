import type { File } from "@darseen/vaze";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ListGroup, Separator, Spinner } from "heroui-native";
import { ChevronLeft, Folder as FolderIcon } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { isConvertibleImage, isConvertibleVideo } from "@/lib/conversion";
import { formatBytes } from "@/lib/format";
import { folderCacheKey, parentKey, useLibrary } from "@/stores/library";
import { FileThumb } from "../files/file-thumb";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { Sheet } from "../sheet";

export type PickableKind = "convertible-video" | "image";

const KINDS: Record<
  PickableKind,
  { accepts: (file: File) => boolean; one: string; many: string }
> = {
  // the video converter reads animated GIFs too
  "convertible-video": {
    accepts: isConvertibleVideo,
    one: "a video",
    many: "videos",
  },
  image: { accepts: isConvertibleImage, one: "an image", many: "images" },
};

type FilePickerSheetProps = {
  /** Which files can be picked. */
  kind: PickableKind;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: File) => void;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

/** Browses the server's folders and picks one of its files of a kind, like the web's picker. */
export function FilePickerSheet({
  kind,
  isOpen,
  onOpenChange,
  onSelect,
}: FilePickerSheetProps) {
  const { server, vaze } = useServer();
  const [browseKey, setBrowseKey] = useState("");
  const contents = useLibrary(
    (state) => state.folders[folderCacheKey(server.id, browseKey)],
  );
  const loadFolder = useLibrary((state) => state.loadFolder);

  useEffect(() => {
    if (isOpen) loadFolder(server.id, vaze, browseKey);
  }, [isOpen, browseKey, server.id, vaze, loadFolder]);

  const folders = [...(contents?.data?.folders ?? [])].sort(byName);
  const files = contents?.data?.files ?? [];
  const matches = files.filter(KINDS[kind].accepts).sort(byName);
  const rows = [
    ...folders.map((folder) => ({ type: "folder" as const, folder })),
    ...matches.map((file) => ({ type: "file" as const, file })),
  ];

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Choose from Vaze"
      description={`Open a folder to look inside, then pick ${KINDS[kind].one}.`}
      scrollable
    >
      <View className="flex-1 gap-3">
        <View className="h-9 flex-row items-center gap-2">
          {browseKey ? (
            <Pressable
              onPress={() => setBrowseKey(parentKey(browseKey))}
              hitSlop={10}
              accessibilityLabel="Up one folder"
              className="-ml-1"
            >
              <Icon icon={ChevronLeft} size={22} />
            </Pressable>
          ) : null}
          <Text
            numberOfLines={1}
            className="flex-1 text-base font-medium text-foreground"
          >
            {browseKey ? browseKey.split("/").pop() : "All files"}
          </Text>
          {contents?.loading ? <Spinner size="sm" /> : null}
        </View>

        <BottomSheetScrollView style={{ flex: 1 }}>
          {rows.length > 0 ? (
            <ListGroup variant="secondary">
              {rows.map((row, index) => (
                <Fragment
                  key={row.type === "folder" ? row.folder.id : row.file.id}
                >
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  {row.type === "folder" ? (
                    <ListGroup.Item
                      onPress={() => setBrowseKey(row.folder.key)}
                    >
                      <ListGroup.ItemPrefix>
                        <Icon
                          icon={FolderIcon}
                          filled
                          className="text-folder"
                        />
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle numberOfLines={1}>
                          {row.folder.name}
                        </ListGroup.ItemTitle>
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix />
                    </ListGroup.Item>
                  ) : (
                    <ListGroup.Item onPress={() => onSelect(row.file)}>
                      <ListGroup.ItemPrefix>
                        <FileThumb file={row.file} size={36} />
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle numberOfLines={1}>
                          {row.file.name}
                        </ListGroup.ItemTitle>
                        <ListGroup.ItemDescription>
                          {formatBytes(row.file.size)}
                        </ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                    </ListGroup.Item>
                  )}
                </Fragment>
              ))}
            </ListGroup>
          ) : contents?.data ? (
            <Text className="font-normal py-6 text-center text-sm text-muted">
              {files.length > 0
                ? `No ${KINDS[kind].many} in this folder`
                : "This folder is empty"}
            </Text>
          ) : contents?.error ? (
            <Text className="font-normal py-6 text-center text-sm text-muted">
              {contents.error}
            </Text>
          ) : null}
        </BottomSheetScrollView>
      </View>
    </Sheet>
  );
}
