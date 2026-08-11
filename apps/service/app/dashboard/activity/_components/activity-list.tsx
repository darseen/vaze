"use client";

import {
  clearActivities,
  deleteActivities,
} from "@/actions/activity/delete-activities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDate, parseTimestamp } from "@/utils";
import type { Activity, ActivityType } from "@repo/types";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import {
  CheckCircle2,
  CircleSlash,
  FolderX,
  History,
  KeyRound,
  PencilLine,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

export type ActivityRow = Pick<
  Activity,
  "id" | "type" | "target" | "detail" | "createdAt"
>;

const TYPE_META: Record<
  ActivityType,
  { label: string; icon: LucideIcon; tone: string }
> = {
  "upload.succeeded": {
    label: "Upload complete",
    icon: CheckCircle2,
    tone: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  "upload.failed": {
    label: "Upload failed",
    icon: XCircle,
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  "upload.canceled": {
    label: "Upload canceled",
    icon: CircleSlash,
    tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  },
  "file.deleted": {
    label: "File deleted",
    icon: Trash2,
    tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  },
  "file.delete-failed": {
    label: "File delete failed",
    icon: XCircle,
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  "folder.deleted": {
    label: "Folder deleted",
    icon: FolderX,
    tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  },
  "folder.delete-failed": {
    label: "Folder delete failed",
    icon: FolderX,
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  "api-key.created": {
    label: "API key created",
    icon: KeyRound,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  "api-key.renamed": {
    label: "API key renamed",
    icon: PencilLine,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  "api-key.deleted": {
    label: "API key deleted",
    icon: Trash2,
    tone: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "uploads", label: "Uploads" },
  { value: "deletions", label: "Deletions" },
  { value: "api-keys", label: "API keys" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function matchesFilter(type: ActivityType, filter: Filter) {
  if (filter === "uploads") return type.startsWith("upload.");
  if (filter === "deletions")
    return type.startsWith("file.") || type.startsWith("folder.");
  if (filter === "api-keys") return type.startsWith("api-key.");
  return true;
}

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Row({
  activity,
  selected,
  onToggle,
}: {
  activity: ActivityRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = TYPE_META[activity.type];
  const date = parseTimestamp(activity.createdAt);
  const secondary = [activity.target ? meta.label : null, activity.detail]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        selected ? "bg-accent/40" : "hover:bg-accent/20",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-2"
        aria-label={`Select ${meta.label}${activity.target ? ` for ${activity.target}` : ""}`}
      />

      <span className={cn("mt-0.5 rounded-full p-1.5", meta.tone)}>
        <meta.icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {activity.target ?? meta.label}
          </p>
          {/* the server renders this a moment before the browser does */}
          <time
            className="text-muted-foreground shrink-0 text-xs"
            title={formatDate(activity.createdAt)}
            dateTime={date.toISOString()}
            suppressHydrationWarning
          >
            {formatDistanceToNow(date, { addSuffix: true })}
          </time>
        </div>

        {secondary && (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {secondary}
          </p>
        )}
      </div>
    </li>
  );
}

export default function ActivityList({
  activities,
}: {
  activities: ActivityRow[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () => activities.filter((activity) => matchesFilter(activity.type, filter)),
    [activities, filter],
  );

  // one heading per calendar day, in the order the rows already arrive
  const groups = useMemo(() => {
    const out: { label: string; items: ActivityRow[] }[] = [];

    for (const activity of visible) {
      const label = dayLabel(parseTimestamp(activity.createdAt));
      const last = out.at(-1);

      if (last?.label === label) last.items.push(activity);
      else out.push({ label, items: [activity] });
    }

    return out;
  }, [visible]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((activity) => selected.has(activity.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      allVisibleSelected
        ? new Set()
        : new Set(visible.map((activity) => activity.id)),
    );

  // a hidden row cannot be unselected, so a filter switch starts over
  const changeFilter = (value: string) => {
    setFilter(value as Filter);
    setSelected(new Set());
  };

  const removeSelected = () => {
    const ids = [...selected];

    startTransition(async () => {
      const { error } = await deleteActivities(ids);
      if (error) {
        toast.error(error.message);
        return;
      }

      setSelected(new Set());
      toast.success(
        `Deleted ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`,
      );
    });
  };

  const removeAll = () =>
    startTransition(async () => {
      const { error } = await clearActivities();
      if (error) {
        toast.error(error.message);
        return;
      }

      setSelected(new Set());
      toast.success("Activity history cleared");
    });

  if (activities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <History className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Nothing here yet
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            Uploads and API key changes show up here as they happen, so you can
            check what went through and what did not.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={changeFilter}>
          <TabsList>
            {FILTERS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={removeSelected}
            disabled={selected.size === 0 || pending}
          >
            <Trash2 className="mr-2 size-4" />
            Delete selected
            {selected.size > 0 && ` (${selected.size})`}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={pending}>
                Clear all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear activity history</AlertDialogTitle>
                <AlertDialogDescription className="text-pretty">
                  This deletes every entry, including the ones hidden by the
                  current filter. Your files and API keys are not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={removeAll}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={toggleAll}
            disabled={visible.length === 0}
            aria-label="Select all shown entries"
          />
          <span className="text-muted-foreground text-xs">
            {selected.size > 0
              ? `${selected.size} selected`
              : `${visible.length} ${visible.length === 1 ? "entry" : "entries"}`}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            Nothing matches this filter.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label}>
              <h3 className="text-muted-foreground bg-muted/40 px-4 py-1.5 text-[11px] font-medium tracking-wider uppercase">
                {group.label}
              </h3>
              <ul className="divide-y">
                {group.items.map((activity) => (
                  <Row
                    key={activity.id}
                    activity={activity}
                    selected={selected.has(activity.id)}
                    onToggle={() => toggle(activity.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>
    </div>
  );
}
