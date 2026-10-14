import type { FileReference } from "@darseen/vaze";
import {
  router,
  Stack,
  useFocusEffect,
  useNavigation,
  type Href,
} from "expo-router";
import {
  Button,
  cn,
  Separator,
  Spinner,
  Surface,
  useThemeColor,
  useToast,
} from "heroui-native";
import {
  ArrowUpDown,
  File as FileIcon,
  Folder as FolderIcon,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useShallow } from "zustand/react/shallow";
import { pickDocuments, pickMedia } from "@/lib/transfer";
import { folderCacheKey, joinKey, useLibrary } from "@/stores/library";
import {
  usePreferences,
  type FileView,
  type SortBy,
} from "@/stores/preferences";
import { useUploads } from "@/stores/uploads";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { AddSheet } from "./add-sheet";
import { Breadcrumb } from "./breadcrumb";
import { EntryCard } from "./entry-card";
import { useEntryActions } from "./entry-actions";
import { EntryRow, type Entry } from "./entry-row";
import { NameSheet } from "./name-sheet";
import { SortSheet } from "./sort-sheet";

type SheetName = "add" | "sort" | "new-folder";

const GUTTER = 20;
const GAP = 12;

const VIEWS: { value: FileView; label: string; icon: LucideIcon }[] = [
  { value: "grid", label: "Grid view", icon: LayoutGrid },
  { value: "list", label: "List view", icon: List },
];

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

function compareFiles(by: SortBy) {
  return (a: Entry & { type: "file" }, b: Entry & { type: "file" }) => {
    if (by === "size") return a.file.size - b.file.size;
    // timestamps are zero-padded, so string order is time order
    if (by === "createdAt")
      return a.file.createdAt.localeCompare(b.file.createdAt);
    return byName(a.file, b.file);
  };
}

// lets a closing sheet finish before a system picker slides over it
const afterSheetCloses = () =>
  new Promise((resolve) => setTimeout(resolve, 300));

function folderKeyOf(route: { name: string; params?: object }) {
  if (route.name === "index") return "";
  const key = (route.params as { key?: string | string[] } | undefined)?.key;
  if (key === undefined) return null;
  return Array.isArray(key) ? key.join("/") : key;
}

const GridGap = () => <View className="h-3" />;
const RowSeparator = () => <Separator className="ml-[72px] opacity-50" />;

export function FolderBrowser({ folderKey }: { folderKey: string }) {
  const { server, vaze, can } = useServer();
  const { toast } = useToast();
  const actions = useEntryActions();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [pulling, setPulling] = useState(false);
  const muted = useThemeColor("muted");
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const contents = useLibrary(
    (state) => state.folders[folderCacheKey(server.id, folderKey)],
  );
  const loadFolder = useLibrary((state) => state.loadFolder);
  const loadStats = useLibrary((state) => state.loadStats);
  const sortBy = usePreferences((state) => state.sortBy);
  const sortDirection = usePreferences((state) => state.sortDirection);
  const fileView = usePreferences((state) => state.fileView);
  const startUploads = useUploads((state) => state.start);
  const uploads = useUploads(
    useShallow((state) =>
      state.uploads.filter(
        (upload) =>
          upload.serverId === server.id && upload.folderKey === folderKey,
      ),
    ),
  );

  const refresh = useCallback(
    () => loadFolder(server.id, vaze, folderKey),
    [loadFolder, server.id, vaze, folderKey],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const entries = useMemo<Entry[]>(() => {
    if (!contents?.data) return [];
    const direction = sortDirection === "ASC" ? 1 : -1;

    const folders = [...contents.data.folders]
      .sort((a, b) => byName(a, b) * (sortBy === "name" ? direction : 1))
      .map((folder): Entry => ({ type: "folder", folder }));
    const files = contents.data.files
      .map((file) => ({ type: "file" as const, file }))
      .sort((a, b) => compareFiles(sortBy)(a, b) * direction);

    return [...folders, ...files];
  }, [contents?.data, sortBy, sortDirection]);

  const closer = (name: SheetName) => (open: boolean) => {
    if (!open) setSheet((current) => (current === name ? null : current));
  };

  async function upload(pick: () => Promise<FileReference[]>) {
    setSheet(null);
    await afterSheetCloses();
    const files = await pick();
    if (files.length === 0) return;

    const { uploaded, failed } = await startUploads(
      server.id,
      vaze,
      folderKey,
      files,
    );
    loadStats(server.id, vaze);

    if (failed.length === 0) {
      toast.show({
        variant: "success",
        label:
          uploaded === 1 ? "Uploaded 1 file" : `Uploaded ${uploaded} files`,
      });
    } else {
      toast.show({
        variant: "danger",
        label:
          failed.length === 1
            ? `Couldn't upload ${failed[0].name}`
            : `${failed.length} uploads failed`,
        description: failed[0].error,
      });
    }
  }

  async function createFolder(name: string) {
    const { error } = await vaze.folders.create(joinKey(folderKey, name));
    if (error) return error.message;
    refresh();
    loadStats(server.id, vaze);
    return null;
  }

  function folderHref(key: string): Href {
    return key
      ? {
          pathname: "/server/[id]/files/[...key]",
          params: { id: server.id, key: key.split("/") },
        }
      : { pathname: "/server/[id]/files", params: { id: server.id } };
  }

  function goToFolder(key: string) {
    const state = navigation.getState();
    // pop back to the folder's screen so the stack keeps mirroring the path
    const target =
      state?.routes.findLastIndex(
        (route, index) => index < state.index && folderKeyOf(route) === key,
      ) ?? -1;
    if (state && target >= 0) router.dismiss(state.index - target);
    else router.replace(folderHref(key));
  }

  function openEntry(entry: Entry) {
    if (entry.type === "folder") {
      router.push(folderHref(entry.folder.key));
    } else {
      actions.open(entry);
    }
  }

  const canWrite = can("files:write");
  const title = folderKey ? (folderKey.split("/").pop() ?? folderKey) : "Files";
  const done = uploads.filter(
    (upload) => upload.status === "done" || upload.status === "failed",
  ).length;
  const current = uploads.find((upload) => upload.status === "uploading");
  const grid = fileView === "grid";
  const cardWidth = Math.floor((width - GUTTER * 2 - GAP) / 2);
  const folderCount = contents?.data?.folders.length ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: !folderKey,
          headerRight: canWrite
            ? () => (
                <Pressable
                  onPress={() => setSheet("add")}
                  hitSlop={10}
                  className="px-1"
                  accessibilityLabel="Add"
                >
                  <Icon icon={Plus} size={24} />
                </Pressable>
              )
            : undefined,
        }}
      />

      {folderKey ? (
        <Breadcrumb folderKey={folderKey} onNavigate={goToFolder} />
      ) : null}

      <FlatList
        // a column count change needs a fresh list
        key={fileView}
        data={entries}
        numColumns={grid ? 2 : 1}
        columnWrapperStyle={
          grid ? { gap: GAP, paddingHorizontal: GUTTER } : undefined
        }
        keyExtractor={(entry) =>
          entry.type === "file" ? entry.file.id : entry.folder.id
        }
        renderItem={({ item }) =>
          grid ? (
            <EntryCard
              entry={item}
              width={cardWidth}
              onPress={() => openEntry(item)}
              onOptions={() => actions.open(item)}
            />
          ) : (
            <EntryRow
              entry={item}
              onPress={() => openEntry(item)}
              onLongPress={() => actions.open(item)}
            />
          )
        }
        ItemSeparatorComponent={grid ? GridGap : RowSeparator}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="grow pb-6"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await refresh();
              setPulling(false);
            }}
          />
        }
        ListHeaderComponent={
          <>
            {current ? (
              <Surface
                variant="secondary"
                className="mx-5 mt-3 flex-row items-center gap-3 rounded-3xl p-4"
              >
                <Spinner size="sm" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    Uploading {done + 1} of {uploads.length}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="font-normal text-xs text-muted"
                  >
                    {current.name}
                  </Text>
                </View>
              </Surface>
            ) : null}
            {entries.length > 0 ? (
              <Toolbar
                folders={folderCount}
                files={entries.length - folderCount}
                onSort={() => setSheet("sort")}
              />
            ) : null}
          </>
        }
        ListEmptyComponent={
          contents?.error && !contents.data ? (
            <EmptyState
              icon={TriangleAlert}
              title="Couldn't load this folder"
              message={contents.error}
              action={
                <Button variant="secondary" onPress={refresh}>
                  Try again
                </Button>
              }
            />
          ) : contents?.data ? (
            <EmptyState
              icon={FolderOpen}
              title="Nothing here yet"
              message={
                canWrite
                  ? "Upload photos and files, or make a folder."
                  : "This folder is empty."
              }
              action={
                canWrite ? (
                  <Button onPress={() => setSheet("add")}>Add files</Button>
                ) : null
              }
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Spinner />
            </View>
          )
        }
      />

      {actions.element}
      <AddSheet
        isOpen={sheet === "add"}
        onOpenChange={closer("add")}
        onPickMedia={() => upload(pickMedia)}
        onPickFiles={() => upload(pickDocuments)}
        onNewFolder={() => setSheet("new-folder")}
      />
      <SortSheet isOpen={sheet === "sort"} onOpenChange={closer("sort")} />
      <NameSheet
        isOpen={sheet === "new-folder"}
        onOpenChange={closer("new-folder")}
        title="New folder"
        placeholder="Folder name"
        submitLabel="Create"
        onSubmit={createFolder}
      />
    </>
  );
}

function Toolbar({
  folders,
  files,
  onSort,
}: {
  folders: number;
  files: number;
  onSort: () => void;
}) {
  const fileView = usePreferences((state) => state.fileView);
  const setFileView = usePreferences((state) => state.setFileView);

  return (
    <View className="flex-row items-center gap-2 px-5 py-3">
      <View className="flex-1 flex-row flex-wrap gap-2">
        {folders > 0 ? <CountBadge kind="folder" count={folders} /> : null}
        {files > 0 ? <CountBadge kind="file" count={files} /> : null}
      </View>
      <View className="rounded-2xl border border-border p-0.5">
        <Pressable
          onPress={onSort}
          className="size-8 items-center justify-center rounded-xl active:bg-default"
          accessibilityLabel="Sort"
        >
          <Icon icon={ArrowUpDown} size={16} />
        </Pressable>
      </View>
      <View className="flex-row rounded-2xl border border-border p-0.5">
        {VIEWS.map((view) => {
          const active = view.value === fileView;
          return (
            <Pressable
              key={view.value}
              onPress={() => setFileView(view.value)}
              className={cn(
                "size-8 items-center justify-center rounded-xl",
                active && "bg-default",
              )}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={view.label}
            >
              <Icon
                icon={view.icon}
                size={16}
                className={active ? "text-foreground" : "text-muted"}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CountBadge({
  kind,
  count,
}: {
  kind: "folder" | "file";
  count: number;
}) {
  const folder = kind === "folder";
  const tint = folder
    ? "text-folder-badge-foreground"
    : "text-file-badge-foreground";

  return (
    <View
      className={cn(
        "flex-row items-center gap-1 rounded-xl border px-2.5 py-1",
        folder
          ? "border-folder-badge-border bg-folder-badge"
          : "border-file-badge-border bg-file-badge",
      )}
    >
      <Icon icon={folder ? FolderIcon : FileIcon} size={12} className={tint} />
      <Text className={cn("text-xs font-medium", tint)}>
        {count} {folder ? "folder" : "file"}
        {count === 1 ? "" : "s"}
      </Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: typeof FolderOpen;
  title: string;
  message: string;
  action: ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-10 py-16">
      <View className="size-14 items-center justify-center rounded-full bg-default">
        <Icon icon={icon} size={26} className="text-muted" />
      </View>
      <View className="items-center gap-1">
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="font-normal text-center text-sm text-muted">
          {message}
        </Text>
      </View>
      {action}
    </View>
  );
}
