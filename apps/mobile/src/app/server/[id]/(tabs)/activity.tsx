import type { Activity } from "@darseen/vaze";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import {
  Button,
  Checkbox,
  cn,
  Separator,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import { Ellipsis, History, ListChecks, Trash2, X } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  BackHandler,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  View,
} from "react-native";
import { ActionGroup } from "@/components/action-group";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState, LoadState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { Sheet, SHEET_CLOSE_MS } from "@/components/sheet";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_META,
  dayLabel,
  matchesFilter,
  type ActivityFilter,
} from "@/lib/activity";
import { formatDateTime, timeAgo } from "@/lib/format";

type SheetName = "menu" | "clear";

const RowSeparator = () => <Separator className="ml-[68px] opacity-50" />;

export default function ActivityScreen() {
  const { vaze } = useServer();
  const { toast } = useToast();
  const muted = useThemeColor("muted");
  const dangerForeground = useThemeColor("danger-foreground");
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [sheet, setSheet] = useState<SheetName | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await vaze.activity.getAll();
    if (data) {
      setActivities(data.activities);
      setError(null);
    } else {
      setError(error.message);
    }
  }, [vaze]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  // Android's back button leaves selection before it leaves the tab
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

  const visible = useMemo(
    () =>
      (activities ?? []).filter((activity) =>
        matchesFilter(activity.type, filter),
      ),
    [activities, filter],
  );

  // only admins ever have user entries, so everyone else never sees the filter
  const filters = useMemo(
    () =>
      ACTIVITY_FILTERS.filter(
        (option) =>
          option.value !== "users" ||
          activities?.some((activity) => matchesFilter(activity.type, "users")),
      ),
    [activities],
  );

  // one section per calendar day, in the order the rows already arrive
  const sections = useMemo(() => {
    const out: { title: string; data: Activity[] }[] = [];
    for (const activity of visible) {
      const title = dayLabel(activity.createdAt);
      const last = out.at(-1);
      if (last?.title === title) last.data.push(activity);
      else out.push({ title, data: [activity] });
    }
    return out;
  }, [visible]);

  const closer = (name: SheetName) => (open: boolean) => {
    if (!open) setSheet((current) => (current === name ? null : current));
  };

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function startSelecting(id?: string) {
    if (id) Haptics.selectionAsync();
    setSelecting(true);
    setSelected(new Set(id ? [id] : []));
  }

  // a hidden row can't be unselected, so a filter switch starts over
  function changeFilter(next: ActivityFilter) {
    setFilter(next);
    setSelected(new Set());
  }

  const allSelected =
    visible.length > 0 &&
    visible.every((activity) => selected.has(activity.id));

  async function removeSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;

    setDeleting(true);
    const { error } = await vaze.activity.delete(ids);
    setDeleting(false);

    if (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't delete entries",
        description: error.message,
      });
      return;
    }

    setActivities(
      (current) =>
        current?.filter((activity) => !selected.has(activity.id)) ?? null,
    );
    stopSelecting();
    toast.show({
      variant: "success",
      label: `Deleted ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`,
    });
  }

  async function clearAll() {
    const { error } = await vaze.activity.clear();
    const notice = error
      ? {
          variant: "danger" as const,
          label: "Couldn't clear the history",
          description: error.message,
        }
      : { variant: "success" as const, label: "Activity history cleared" };

    if (!error) {
      setActivities([]);
      stopSelecting();
    }
    setTimeout(() => toast.show(notice), SHEET_CLOSE_MS);
  }

  const hasEntries = Boolean(activities && activities.length > 0);

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 px-5 pt-safe-offset-4 pb-3">
        {selecting ? (
          <View className="h-12 flex-row items-center gap-2">
            <Pressable
              onPress={stopSelecting}
              hitSlop={10}
              className="size-9 items-center justify-center rounded-xl active:bg-default"
              accessibilityLabel="Stop selecting"
            >
              <Icon icon={X} size={22} />
            </Pressable>
            <Text className="flex-1 text-xl font-semibold text-foreground">
              {selected.size} selected
            </Text>
            <Button
              size="sm"
              variant="ghost"
              onPress={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(visible.map((activity) => activity.id)),
                )
              }
              isDisabled={visible.length === 0}
            >
              {allSelected ? "None" : "All"}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onPress={removeSelected}
              isDisabled={selected.size === 0 || deleting}
            >
              {deleting ? (
                <Spinner size="sm" color={dangerForeground} />
              ) : (
                <Icon
                  icon={Trash2}
                  size={16}
                  className="text-danger-foreground"
                />
              )}
              <Button.Label>Delete</Button.Label>
            </Button>
          </View>
        ) : (
          <View className="h-12 flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-2xl font-semibold text-foreground">
                Activity
              </Text>
              <Text
                numberOfLines={1}
                className="font-normal text-sm text-muted"
              >
                Uploads, deletions and account changes
              </Text>
            </View>
            {hasEntries ? (
              <Pressable
                onPress={() => setSheet("menu")}
                hitSlop={10}
                className="size-9 items-center justify-center rounded-xl active:bg-default"
                accessibilityLabel="Activity options"
              >
                <Icon icon={Ellipsis} size={22} />
              </Pressable>
            ) : null}
          </View>
        )}

        {hasEntries ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5"
            contentContainerClassName="gap-2 px-5"
          >
            {filters.map((option) => {
              const active = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => changeFilter(option.value)}
                  className={cn(
                    "rounded-2xl border px-3 py-1.5",
                    active
                      ? "border-accent bg-accent"
                      : "border-border active:bg-default",
                  )}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-accent-foreground" : "text-foreground",
                    )}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(activity) => activity.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View className="bg-background px-5 pt-3 pb-1.5">
            <Text className="text-xs font-medium uppercase text-muted">
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ActivityRow
            activity={item}
            selecting={selecting}
            selected={selected.has(item.id)}
            onToggle={() => toggle(item.id)}
            onLongPress={() =>
              selecting ? toggle(item.id) : startSelecting(item.id)
            }
          />
        )}
        ItemSeparatorComponent={RowSeparator}
        contentContainerClassName="grow pb-8"
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
        ListEmptyComponent={
          activities === null ? (
            <LoadState error={error} onRetry={load} />
          ) : activities.length === 0 ? (
            <View className="px-5 pt-2">
              <EmptyState
                icon={History}
                title="Nothing here yet"
                message="Uploads, deletions and API key changes show up here as they happen, so you can check what went through."
              />
            </View>
          ) : (
            <Text className="font-normal px-5 py-10 text-center text-sm text-muted">
              Nothing matches this filter.
            </Text>
          )
        }
      />

      <Sheet
        isOpen={sheet === "menu"}
        onOpenChange={closer("menu")}
        title="Activity"
        description="Entries are also pruned automatically after a while."
      >
        <View className="gap-3">
          <ActionGroup
            actions={[
              {
                label: "Select entries",
                icon: ListChecks,
                description: "Or long-press an entry",
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
                label: "Clear history",
                icon: Trash2,
                description: "Deletes every entry",
                danger: true,
                onPress: () => setSheet("clear"),
              },
            ]}
          />
        </View>
      </Sheet>
      <ConfirmSheet
        isOpen={sheet === "clear"}
        onOpenChange={closer("clear")}
        title="Clear activity history?"
        description="This deletes every entry, including ones hidden by the current filter. Your files, API keys and users are not affected."
        confirmLabel="Clear history"
        onConfirm={clearAll}
      />
    </View>
  );
}

function ActivityRow({
  activity,
  selecting,
  selected,
  onToggle,
  onLongPress,
}: {
  activity: Activity;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const meta = ACTIVITY_META[activity.type];
  const secondary = [activity.target ? meta.label : null, activity.detail]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={selecting ? onToggle : undefined}
      onLongPress={onLongPress}
      className={cn(
        "flex-row items-start gap-3 px-5 py-3",
        selected ? "bg-default" : "active:bg-default-soft",
      )}
      accessibilityLabel={`${meta.label}${activity.target ? `, ${activity.target}` : ""}, ${formatDateTime(activity.createdAt)}`}
      accessibilityState={selecting ? { selected } : undefined}
    >
      {selecting ? (
        <View className="h-9 justify-center">
          <Checkbox isSelected={selected} onSelectedChange={onToggle} />
        </View>
      ) : null}
      <View
        className={cn(
          "size-9 items-center justify-center rounded-full",
          meta.tone.badge,
        )}
      >
        <Icon icon={meta.icon} size={18} className={meta.tone.icon} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 text-sm font-medium text-foreground"
          >
            {activity.target ?? meta.label}
          </Text>
          <Text className="font-normal text-xs text-muted">
            {timeAgo(activity.createdAt)}
          </Text>
        </View>
        {secondary ? (
          <Text numberOfLines={2} className="font-normal text-xs text-muted">
            {secondary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
