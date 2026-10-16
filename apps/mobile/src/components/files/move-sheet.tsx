import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  Button,
  ListGroup,
  Separator,
  Spinner,
  useThemeColor,
} from "heroui-native";
import { ChevronLeft, Folder as FolderIcon } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { folderCacheKey, parentKey, useLibrary } from "@/stores/library";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { Sheet } from "../sheet";
import type { Entry } from "./entry-row";

type MoveSheetProps = {
  /** What's moving, all from one folder. */
  entries: Entry[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves to an error message, or null once moved. */
  onMove: (destination: string) => Promise<string | null>;
};

export function MoveSheet({
  entries,
  isOpen,
  onOpenChange,
  onMove,
}: MoveSheetProps) {
  const { server, vaze } = useServer();
  const [browseKey, setBrowseKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spinnerColor = useThemeColor("accent-foreground");
  const contents = useLibrary(
    (state) => state.folders[folderCacheKey(server.id, browseKey)],
  );
  const loadFolder = useLibrary((state) => state.loadFolder);

  const first = entries[0];
  const source = first
    ? parentKey(first.type === "file" ? first.file.key : first.folder.key)
    : "";
  const movingFolders = entries.flatMap((entry) =>
    entry.type === "folder" ? [entry.folder] : [],
  );

  useEffect(() => {
    if (!isOpen) return;
    setBrowseKey(source);
    setError(null);
  }, [isOpen, source]);

  useEffect(() => {
    if (isOpen) loadFolder(server.id, vaze, browseKey);
  }, [isOpen, browseKey, server.id, vaze, loadFolder]);

  const insideItself = movingFolders.some(
    (folder) =>
      browseKey === folder.key || browseKey.startsWith(`${folder.key}/`),
  );
  const canMoveHere = browseKey !== source && !insideItself && !busy;

  const folders = (contents?.data?.folders ?? [])
    .filter(
      (folder) => !movingFolders.some((moving) => moving.id === folder.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const name =
    entries.length === 1
      ? first.type === "file"
        ? first.file.name
        : first.folder.name
      : `${entries.length} files`;
  const location = browseKey ? browseKey.split("/").pop() : "All files";

  async function move() {
    if (!canMoveHere) return;
    setBusy(true);
    const message = await onMove(browseKey);
    setBusy(false);
    if (message) setError(message);
    else onOpenChange(false);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={`Move ${name}`}
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
            {location}
          </Text>
          {contents?.loading ? <Spinner size="sm" /> : null}
        </View>

        <BottomSheetScrollView style={{ flex: 1 }}>
          {folders.length > 0 ? (
            <ListGroup variant="secondary">
              {folders.map((folder, index) => (
                <Fragment key={folder.id}>
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  <ListGroup.Item onPress={() => setBrowseKey(folder.key)}>
                    <ListGroup.ItemPrefix>
                      <Icon icon={FolderIcon} filled className="text-folder" />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle numberOfLines={1}>
                        {folder.name}
                      </ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix />
                  </ListGroup.Item>
                </Fragment>
              ))}
            </ListGroup>
          ) : contents?.data ? (
            <Text className="font-normal py-6 text-center text-sm text-muted">
              No folders in here
            </Text>
          ) : null}
        </BottomSheetScrollView>

        {error ? (
          <Text className="font-normal text-sm text-danger">{error}</Text>
        ) : null}
        <Button onPress={move} isDisabled={!canMoveHere}>
          {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
          <Button.Label>
            {insideItself ? "Can't move a folder into itself" : "Move here"}
          </Button.Label>
        </Button>
      </View>
    </Sheet>
  );
}
