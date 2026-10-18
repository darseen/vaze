import { cn } from "@/lib/utils";
import { formatBytes, parseTimestamp } from "@/utils";
import {
  CATEGORY_LABELS,
  getMimeCategory,
  type FileCategory,
} from "@/utils/file-type";
import type { Stats } from "@repo/types";
import { formatDistanceToNow } from "date-fns";
import { Globe, Lock } from "lucide-react";
import DailyChart from "./daily-chart";
import FileRows from "./file-rows";
import { CATEGORY_BARS, folderOf, formatDay, plural } from "./helpers";
import { Empty, Figure, Panel } from "./panel";

type FileStats = NonNullable<Stats["files"]>;

export function FilesAdded({
  added,
}: {
  added: NonNullable<FileStats["added"]>;
}) {
  const count = added.reduce((sum, day) => sum + day.count, 0);
  const size = added.reduce((sum, day) => sum + day.size, 0);

  return (
    <Panel
      title="Files Added"
      description="New uploads over the last 30 days, of the files still stored"
      aside={
        <Figure
          value={count.toLocaleString("en-US")}
          label={formatBytes(size)}
        />
      }
    >
      {count === 0 ? (
        <Empty>No uploads in the last 30 days</Empty>
      ) : (
        <DailyChart
          variant="bar"
          name="Files"
          data={added.map((day) => ({
            date: day.date,
            tick: formatDay(day.date),
            label: formatDay(day.date),
            value: day.count,
            details: [plural(day.count, "file"), formatBytes(day.size)],
          }))}
        />
      )}
    </Panel>
  );
}

export function RecentFiles({ files }: { files: FileStats["recent"] }) {
  return (
    <Panel title="Recent Files" description="Latest uploaded files">
      {files.length === 0 ? (
        <Empty>No files uploaded yet</Empty>
      ) : (
        <FileRows
          rows={files.map((file) => ({
            file,
            meta: folderOf(file.key),
            aside: formatBytes(file.size),
            asideDetail: formatDistanceToNow(parseTimestamp(file.createdAt), {
              addSuffix: true,
            }),
          }))}
        />
      )}
    </Panel>
  );
}

export function LargestFiles({ files }: { files: FileStats["largest"] }) {
  const largest = Math.max(...files.map((file) => file.size), 1);

  return (
    <Panel
      title="Largest Files"
      description="Files consuming the most storage space"
    >
      {files.length === 0 ? (
        <Empty>No files uploaded yet</Empty>
      ) : (
        <FileRows
          rows={files.map((file) => ({
            file,
            share: file.size / largest,
            aside: formatBytes(file.size),
          }))}
        />
      )}
    </Panel>
  );
}

export function TypeBreakdown({ types }: { types: FileStats["types"] }) {
  const groups = new Map<FileCategory, { size: number; count: number }>();
  for (const type of types) {
    const category = getMimeCategory(type.mimeType);
    const group = groups.get(category) ?? { size: 0, count: 0 };
    groups.set(category, {
      size: group.size + type.size,
      count: group.count + type.count,
    });
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].size - a[1].size);
  const total = sorted.reduce((sum, [, group]) => sum + group.size, 0);

  return (
    <Panel
      title="Storage by File Type"
      description="Breakdown of storage usage by file type"
    >
      {total === 0 ? (
        <Empty>No files uploaded yet</Empty>
      ) : (
        <div className="space-y-5">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {sorted
              .filter(([, group]) => group.size > 0)
              .map(([category, group]) => (
                <div
                  key={category}
                  className={CATEGORY_BARS[category]}
                  title={`${CATEGORY_LABELS[category]}: ${formatBytes(group.size)}`}
                  style={{ flex: group.size / total }}
                />
              ))}
          </div>
          <ul className="space-y-3">
            {sorted.map(([category, group]) => (
              <li key={category} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    CATEGORY_BARS[category],
                  )}
                />
                <span className="flex-1">{CATEGORY_LABELS[category]}</span>
                <span className="text-muted-foreground">
                  {group.count.toLocaleString("en-US")} ·{" "}
                  {formatBytes(group.size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const VISIBILITY_INFO = {
  public: {
    label: "Public",
    hint: "Anyone with the link can open these",
    icon: Globe,
    bar: "bg-usage",
  },
  private: {
    label: "Private",
    hint: "Need a signed link, an API key or an account",
    icon: Lock,
    bar: "bg-kind-images",
  },
} as const;

export function Visibility({
  visibility,
}: {
  visibility: NonNullable<FileStats["visibility"]>;
}) {
  const total = visibility.public.count + visibility.private.count;

  return (
    <Panel
      title="Visibility"
      description="How many of your files anyone on the internet can read"
    >
      {total === 0 ? (
        <Empty>No files uploaded yet</Empty>
      ) : (
        <div className="space-y-5">
          <div className="bg-muted flex h-3 gap-0.5 overflow-hidden rounded-full">
            {(["public", "private"] as const)
              .filter((key) => visibility[key].count > 0)
              .map((key) => (
                <div
                  key={key}
                  className={VISIBILITY_INFO[key].bar}
                  style={{ flex: visibility[key].count / total }}
                />
              ))}
          </div>
          <ul className="space-y-4">
            {(["public", "private"] as const).map((key) => {
              const info = VISIBILITY_INFO[key];
              return (
                <li key={key} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      info.bar,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <info.icon className="text-muted-foreground size-3.5" />
                      {info.label}
                    </p>
                    <p className="text-muted-foreground text-xs">{info.hint}</p>
                  </div>
                  <span className="text-muted-foreground">
                    {plural(visibility[key].count, "file")} ·{" "}
                    {formatBytes(visibility[key].size)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}
