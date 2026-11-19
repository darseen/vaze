import { Button } from "@/components/ui/button";
import { formatBytes } from "@/utils";
import { ArrowDown, ArrowUp, X, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { ConversionSource } from "../../conversion/_components/request-conversion";

export interface ListedSource {
  /** Picking the same file twice adds it twice, so each pick has a key of its own. */
  key: number;
  source: ConversionSource;
}

/** An ordered list of picked files, where order is what the result follows. */
export function useSourceList(onChange: () => void) {
  const [items, setItems] = useState<ListedSource[]>([]);
  const nextKey = useRef(0);

  const update = (next: (items: ListedSource[]) => ListedSource[]) => {
    setItems(next);
    onChange();
  };

  return {
    items,
    sources: items.map((item) => item.source),
    add: (source: ConversionSource) =>
      update((items) => [...items, { key: nextKey.current++, source }]),
    remove: (key: number) =>
      update((items) => items.filter((item) => item.key !== key)),
    move: (key: number, by: -1 | 1) =>
      update((items) => {
        const from = items.findIndex((item) => item.key === key);
        const to = from + by;
        if (from < 0 || to < 0 || to >= items.length) return items;
        const next = [...items];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      }),
    clear: () => update(() => []),
  };
}

export function SourceList({
  items,
  icon: Icon,
  disabled,
  onMove,
  onRemove,
}: {
  items: ListedSource[];
  icon: LucideIcon;
  disabled: boolean;
  onMove: (key: number, by: -1 | 1) => void;
  onRemove: (key: number) => void;
}) {
  return (
    <ol className="divide-y">
      {items.map(({ key, source }, index) => (
        <li key={key} className="flex items-center gap-3 py-2.5 first:pt-0">
          <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
            {index + 1}
          </span>
          <div className="bg-secondary text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{source.file.name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatBytes(source.file.size)} ·{" "}
              {source.kind === "device" ? "Your device" : "Vaze"}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8"
              disabled={disabled || index === 0}
              onClick={() => onMove(key, -1)}
              aria-label={`Move ${source.file.name} up`}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8"
              disabled={disabled || index === items.length - 1}
              onClick={() => onMove(key, 1)}
              aria-label={`Move ${source.file.name} down`}
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8"
              disabled={disabled}
              onClick={() => onRemove(key)}
              aria-label={`Remove ${source.file.name}`}
            >
              <X />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
