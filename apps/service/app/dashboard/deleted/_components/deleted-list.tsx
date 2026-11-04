"use client";

import {
  CATEGORY_ICONS,
  folderOf,
} from "@/app/dashboard/_components/overview/helpers";
import { useCan } from "@/app/dashboard/_components/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatBytes, formatDate, parseTimestamp } from "@/utils";
import { purgeDeleted, restoreDeleted } from "@/utils/deleted";
import { getFileCategory } from "@/utils/file-type";
import type { DeletedItem } from "@repo/types";
import { formatDistanceToNow, formatDistanceToNowStrict } from "date-fns";
import { ArchiveRestore, CircleX, FolderIcon, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

// an item this close to its purge is called out
const SOON_MS = 3 * 24 * 60 * 60 * 1000;
const soonTone = "text-amber-600 dark:text-amber-400";

const itemWord = (count: number) => (count === 1 ? "item" : "items");

function contents(item: DeletedItem) {
  if (item.type === "file") return formatBytes(item.size);
  const files = `${item.files} ${item.files === 1 ? "file" : "files"}`;
  return item.files > 0 ? `${files}, ${formatBytes(item.size)}` : "Empty";
}

type Confirming =
  { kind: "items"; ids: string[]; title: string } | { kind: "all" };

function Row({
  item,
  now,
  canDelete,
  selected,
  pending,
  onToggle,
  onRestore,
  onPurge,
}: {
  item: DeletedItem;
  now: number;
  canDelete: boolean;
  selected: boolean;
  pending: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const Icon =
    item.type === "folder"
      ? FolderIcon
      : CATEGORY_ICONS[getFileCategory(item.name)];
  const deletedAt = parseTimestamp(item.deletedAt);
  const purgeAt = parseTimestamp(item.purgeAt);
  const remaining = purgeAt.getTime() - now;
  const soon = remaining < SOON_MS;
  const removal =
    remaining > 0
      ? `Removed in ${formatDistanceToNowStrict(purgeAt)}`
      : "Removed soon";

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        selected ? "bg-accent/40" : "hover:bg-accent/20",
      )}
    >
      {canDelete && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${item.name}`}
        />
      )}

      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          item.type === "folder"
            ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={item.key}>
          {item.name}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {folderOf(item.key)} · {contents(item)}
        </p>
        <p
          className={cn(
            "text-xs sm:hidden",
            soon ? soonTone : "text-muted-foreground",
          )}
          suppressHydrationWarning
        >
          {removal}
        </p>
      </div>

      {/* the server renders these a moment before the browser does */}
      <div className="hidden shrink-0 text-right sm:block">
        <p
          className={cn(
            "text-xs font-medium",
            soon ? soonTone : "text-muted-foreground",
          )}
          title={formatDate(item.purgeAt)}
          suppressHydrationWarning
        >
          {removal}
        </p>
        <time
          className="text-muted-foreground text-xs"
          title={formatDate(item.deletedAt)}
          dateTime={deletedAt.toISOString()}
          suppressHydrationWarning
        >
          Deleted {formatDistanceToNow(deletedAt, { addSuffix: true })}
        </time>
      </div>

      {canDelete && (
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRestore}
            disabled={pending}
          >
            <Undo2 className="size-4" />
            <span className="sr-only sm:not-sr-only">Restore</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onPurge}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive size-8"
            aria-label={`Delete ${item.name} for good`}
            title="Delete for good"
          >
            <CircleX className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

export default function DeletedList({
  items,
  retentionDays,
}: {
  items: DeletedItem[];
  retentionDays: number;
}) {
  const router = useRouter();
  const can = useCan();
  const canDelete = can("files:delete");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [pending, startTransition] = useTransition();
  // read once, which is precise enough for a countdown in days
  const [now] = useState(() => Date.now());

  // ids that left the list since are dropped from the selection
  const selectedIds = useMemo(
    () => items.filter((item) => selected.has(item.id)).map((item) => item.id),
    [items, selected],
  );
  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(items.map((item) => item.id)),
    );

  const afterChange = (done: string[]) => {
    if (done.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of done) next.delete(id);
      return next;
    });
    router.refresh();
  };

  const restore = (ids: string[]) =>
    startTransition(async () => afterChange(await restoreDeleted(ids)));

  const purge = (target: Confirming) =>
    startTransition(async () => {
      afterChange(
        await purgeDeleted(
          target.kind === "all" ? { all: true } : { ids: target.ids },
        ),
      );
      setConfirming(null);
    });

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <ArchiveRestore className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Nothing deleted recently
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            Files and folders you delete stay here for {retentionDays}{" "}
            {retentionDays === 1 ? "day" : "days"}, so you can bring them back
            if you change your mind.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {canDelete && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => restore(selectedIds)}
            disabled={selectedIds.length === 0 || pending}
          >
            <Undo2 className="mr-2 size-4" />
            Restore
            {selectedIds.length > 0 && ` (${selectedIds.length})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setConfirming({
                kind: "items",
                ids: selectedIds,
                title: `Delete ${selectedIds.length} ${itemWord(selectedIds.length)} for good?`,
              })
            }
            disabled={selectedIds.length === 0 || pending}
          >
            <CircleX className="mr-2 size-4" />
            Delete for good
            {selectedIds.length > 0 && ` (${selectedIds.length})`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming({ kind: "all" })}
            disabled={pending}
          >
            Empty
          </Button>
        </div>
      )}

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          {canDelete && (
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all items"
            />
          )}
          <span className="text-muted-foreground text-xs">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${items.length} ${itemWord(items.length)}, ${formatBytes(totalSize)}`}
          </span>
        </div>

        <ul className="divide-y">
          {items.map((item) => (
            <Row
              key={item.id}
              item={item}
              now={now}
              canDelete={canDelete}
              selected={selected.has(item.id)}
              pending={pending}
              onToggle={() => toggle(item.id)}
              onRestore={() => restore([item.id])}
              onPurge={() =>
                setConfirming({
                  kind: "items",
                  ids: [item.id],
                  title: `Delete "${item.name}" for good?`,
                })
              }
            />
          ))}
        </ul>
      </Card>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && !pending && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.kind === "all"
                ? "Empty Recently deleted?"
                : confirming?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {confirming?.kind === "all"
                ? `All ${items.length} ${itemWord(items.length)} are removed from storage right away, freeing ${formatBytes(totalSize)}. This can't be undone.`
                : `${confirming?.ids.length === 1 ? "It is" : "They are"} removed from storage right away instead of when the time is up. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // keep the dialog up while the request is in flight
                e.preventDefault();
                if (confirming) purge(confirming);
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending
                ? "Deleting..."
                : confirming?.kind === "all"
                  ? "Empty"
                  : "Delete for good"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
