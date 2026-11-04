import type { DeletedItem } from "@darseen/vaze";
import * as Haptics from "expo-haptics";
import { Stack, useFocusEffect } from "expo-router";
import { cn, Separator, Surface, useThemeColor, useToast } from "heroui-native";
import {
  ArchiveRestore,
  CircleX,
  CloudOff,
  Ellipsis,
  Folder as FolderIcon,
  ListChecks,
  Undo2,
  X,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { ActionGroup } from "@/components/action-group";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState, LoadState } from "@/components/empty-state";
import { SelectMark } from "@/components/files/entry-row";
import { BarButton } from "@/components/files/selection-bar";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { Sheet, SHEET_CLOSE_MS } from "@/components/sheet";
import { useRestore } from "@/hooks/use-restore";
import { fileKind, KIND_INFO } from "@/lib/file-kind";
import {
  formatBytes,
  parseTimestamp,
  plural,
  timeAgo,
  timeUntil,
} from "@/lib/format";
import { parentKey, useLibrary } from "@/stores/library";

// an item this close to its purge is called out, like the web
const SOON_MS = 3 * 24 * 60 * 60 * 1000;

type SheetName = "menu" | "item" | "purge" | "empty";

const itemWord = (count: number) => (count === 1 ? "item" : "items");

function contents(item: DeletedItem) {
  if (item.type === "file") return formatBytes(item.size);
  return item.files > 0
    ? `${plural(item.files, "file")}, ${formatBytes(item.size)}`
    : "Empty";
}

const folderOf = (key: string) => parentKey(key) || "All files";

const RowSeparator = () => <Separator className="ml-[72px] opacity-50" />;

export default function DeletedScreen() {
  const { server, vaze, can } = useServer();
  const { toast } = useToast();
  const { restore } = useRestore();
  const muted = useThemeColor("muted");
  const state = useLibrary((store) => store.deleted[server.id]);
  const loadDeleted = useLibrary((store) => store.loadDeleted);
  const loadStats = useLibrary((store) => store.loadStats);
  const forgetDeleted = useLibrary((store) => store.forgetDeleted);
  const [pulling, setPulling] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [current, setCurrent] = useState<DeletedItem | null>(null);
  const [purging, setPurging] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const canDelete = can("files:delete");
  const items = useMemo(() => state?.data?.items ?? [], [state?.data]);
  const days = state?.data?.retentionDays;

  const load = useCallback(
    () => loadDeleted(server.id, vaze),
    [loadDeleted, server.id, vaze],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  // Android's back button leaves selection before it leaves the screen
  useFocusEffect(
    useCallback(() => {
      if (!selecting) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          stopSelecting();
          return true;
        },
      );
      return () => subscription.remove();
    }, [selecting, stopSelecting]),
  );

  // ids that left the list since are dropped from the selection
  const selectedItems = items.filter((item) => selected.has(item.id));
  const allSelected =
    items.length > 0 && selectedItems.length === items.length;

  const closer = (name: SheetName) => (open: boolean) => {
    if (!open) setSheet((now) => (now === name ? null : now));
  };

  function toggle(id: string) {
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function startSelecting(id?: string) {
    if (!canDelete) return;
    if (id) Haptics.selectionAsync();
    setSelecting(true);
    setSelected(new Set(id ? [id] : []));
  }

  function press(item: DeletedItem) {
    if (selecting) return toggle(item.id);
    if (!canDelete) return;
    setCurrent(item);
    setSheet("item");
  }

  async function restoreItems(targets: DeletedItem[]) {
    setBusy(true);
    const restored = await restore(targets);
    setBusy(false);
    if (restored.length > 0) stopSelecting();
  }

  function confirmPurge(ids: string[]) {
    setPurging(ids);
    setSheet("purge");
  }

  async function purge(target: { ids: string[] } | { all: true }) {
    const { data, error } =
      "all" in target
        ? await vaze.deleted.empty()
        : await vaze.deleted.purge(target.ids);

    const notice = !data
      ? {
          variant: "danger" as const,
          label: "Couldn't delete",
          description: error.message,
        }
      : data.failed.length > 0
        ? {
            variant: "warning" as const,
            label: `Deleted ${data.deleted.length} of ${data.deleted.length + data.failed.length} items`,
            description: data.failed[0].message,
          }
        : {
            variant: "success" as const,
            label:
              "all" in target
                ? "Recently deleted emptied"
                : `Deleted ${data.deleted.length} ${itemWord(data.deleted.length)} for good`,
          };

    if (data && data.deleted.length > 0) {
      forgetDeleted(server.id, data.deleted);
      stopSelecting();
      load();
      loadStats(server.id, vaze);
    }
    setTimeout(() => toast.show(notice), SHEET_CLOSE_MS);
  }

  const header = selecting
    ? {
        title: `${selectedItems.length} selected`,
        headerBackVisible: false,
        gestureEnabled: false,
        headerLeft: () => (
          <Pressable
            onPress={stopSelecting}
            hitSlop={10}
            className="pr-4"
            accessibilityLabel="Stop selecting"
          >
            <Icon icon={X} size={24} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable
            onPress={() =>
              setSelected(
                allSelected
                  ? new Set()
                  : new Set(items.map((item) => item.id)),
              )
            }
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text className="text-base font-medium text-foreground">
              {allSelected ? "Deselect all" : "Select all"}
            </Text>
          </Pressable>
        ),
      }
    : {
        title: "Recently deleted",
        headerBackVisible: true,
        gestureEnabled: true,
        headerLeft: undefined,
        headerRight:
          canDelete && items.length > 0
            ? () => (
                <Pressable
                  onPress={() => setSheet("menu")}
                  hitSlop={10}
                  className="px-1"
                  accessibilityLabel="Recently deleted options"
                >
                  <Icon icon={Ellipsis} size={24} />
                </Pressable>
              )
            : undefined,
      };

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={header} />

      <FlatList
        data={items}
        extraData={selected}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DeletedRow
            item={item}
            selecting={selecting}
            selected={selected.has(item.id)}
            onPress={() => press(item)}
            onLongPress={() =>
              selecting ? toggle(item.id) : startSelecting(item.id)
            }
          />
        )}
        ItemSeparatorComponent={RowSeparator}
        contentInsetAdjustmentBehavior="automatic"
        // room for the selection bar over the last row
        contentContainerStyle={{ paddingBottom: selecting ? 104 : 24 }}
        contentContainerClassName="grow"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await load();
              setPulling(false);
            }}
          />
        }
        ListHeaderComponent={
          items.length > 0 && days !== undefined ? (
            <Text className="font-normal px-5 pt-2 pb-3 text-sm text-muted">
              {plural(items.length, "item")}, {formatBytes(totalSize)}. They
              are removed for good {plural(days, "day")} after they're deleted.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          state?.supported === false ? (
            <View className="px-5 pt-2">
              <EmptyState
                icon={CloudOff}
                title="Not on this server yet"
                message="This server deletes files right away. Update it to keep deleted files and folders here for a while."
              />
            </View>
          ) : state?.data ? (
            <View className="px-5 pt-2">
              <EmptyState
                icon={ArchiveRestore}
                title="Nothing deleted recently"
                message={`Files and folders you delete stay here for ${plural(state.data.retentionDays, "day")}, so you can bring them back.`}
              />
            </View>
          ) : (
            <LoadState error={state?.error ?? null} onRetry={load} />
          )
        }
      />

      {selecting ? (
        <View className="absolute inset-x-0 bottom-0 px-5 pb-safe-offset-3">
          <Surface
            variant="secondary"
            className="flex-row gap-1 rounded-3xl border border-border p-1.5"
          >
            <BarButton
              icon={Undo2}
              label="Restore"
              busy={busy}
              onPress={() =>
                selectedItems.length > 0 && restoreItems(selectedItems)
              }
            />
            <BarButton
              icon={CircleX}
              label="Delete for good"
              danger
              onPress={() =>
                selectedItems.length > 0 &&
                confirmPurge(selectedItems.map((item) => item.id))
              }
            />
          </Surface>
        </View>
      ) : null}

      <Sheet
        isOpen={sheet === "item"}
        onOpenChange={closer("item")}
        title={current?.name}
        description={
          current
            ? `Deleted ${timeAgo(current.deletedAt)} from ${folderOf(current.key)}. ${removal(current)}.`
            : undefined
        }
      >
        <ActionGroup
          actions={[
            {
              label: "Restore",
              icon: Undo2,
              description: `Back to ${folderOf(current?.key ?? "")}`,
              onPress: async () => {
                if (!current) return;
                setSheet(null);
                await new Promise((done) => setTimeout(done, SHEET_CLOSE_MS));
                restoreItems([current]);
              },
            },
            {
              label: "Delete for good",
              icon: CircleX,
              description: "Remove it from the server now",
              danger: true,
              onPress: () => current && confirmPurge([current.id]),
            },
          ]}
        />
      </Sheet>

      <Sheet
        isOpen={sheet === "menu"}
        onOpenChange={closer("menu")}
        title="Recently deleted"
        description={
          days !== undefined
            ? `Items are removed for good ${plural(days, "day")} after they're deleted.`
            : undefined
        }
      >
        <View className="gap-3">
          <ActionGroup
            actions={[
              {
                label: "Select items",
                icon: ListChecks,
                description: "Or long-press an item",
                onPress: () => {
                  setSheet(null);
                  startSelecting();
                },
              },
            ]}
          />
          <ActionGroup
            actions={[
              {
                label: "Empty Recently deleted",
                icon: CircleX,
                description: `Frees ${formatBytes(totalSize)} now`,
                danger: true,
                onPress: () => setSheet("empty"),
              },
            ]}
          />
        </View>
      </Sheet>

      <ConfirmSheet
        isOpen={sheet === "purge"}
        onOpenChange={closer("purge")}
        title={
          purging.length === 1
            ? `Delete ${items.find((item) => item.id === purging[0])?.name ?? "it"} for good?`
            : `Delete ${purging.length} items for good?`
        }
        description={`${purging.length === 1 ? "It's" : "They're"} removed from the server right away. This can't be undone.`}
        confirmLabel="Delete for good"
        onConfirm={() => purge({ ids: purging })}
      />
      <ConfirmSheet
        isOpen={sheet === "empty"}
        onOpenChange={closer("empty")}
        title="Empty Recently deleted?"
        description={`All ${plural(items.length, "item")} are removed from the server right away, freeing ${formatBytes(totalSize)}. This can't be undone.`}
        confirmLabel="Empty"
        onConfirm={() => purge({ all: true })}
      />
    </View>
  );
}

function removal(item: DeletedItem) {
  const left = timeUntil(item.purgeAt);
  return left ? `Removed in ${left}` : "Removed soon";
}

function DeletedRow({
  item,
  selecting,
  selected,
  onPress,
  onLongPress,
}: {
  item: DeletedItem;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const kind =
    item.type === "file" ? KIND_INFO[fileKind(item.name, item.mimeType)] : null;
  const soon = parseTimestamp(item.purgeAt).getTime() - Date.now() < SOON_MS;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center gap-3 px-5 py-2.5 active:bg-default"
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${removal(item)}`}
      accessibilityState={selecting ? { selected } : undefined}
    >
      {selected ? (
        <View pointerEvents="none" className="absolute inset-0 bg-default" />
      ) : null}
      {kind ? (
        <View className="size-10 items-center justify-center rounded-xl bg-default">
          <Icon icon={kind.icon} className="text-muted" />
        </View>
      ) : (
        <View className="size-10 items-center justify-center rounded-xl bg-folder-soft">
          <Icon icon={FolderIcon} filled className="text-folder" />
        </View>
      )}

      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className="font-normal text-base text-foreground"
        >
          {item.name}
        </Text>
        <Text numberOfLines={1} className="font-normal text-sm text-muted">
          {folderOf(item.key)} · {contents(item)}
        </Text>
        <Text
          numberOfLines={1}
          className={cn(
            "font-normal text-xs",
            soon ? "text-warning" : "text-muted",
          )}
        >
          {removal(item)}
        </Text>
      </View>

      {selecting ? <SelectMark selected={selected} /> : null}
    </Pressable>
  );
}
