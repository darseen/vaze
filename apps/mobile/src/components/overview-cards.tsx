import type { File, Stats, StatsAlert } from "@darseen/vaze";
import { Card, cn } from "heroui-native";
import {
  ChevronRight,
  CircleX,
  Globe,
  HardDrive,
  KeyRound,
  Lock,
  TimerOff,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { fileKind, KIND_INFO, type FileKind } from "@/lib/file-kind";
import { formatBytes, formatDay, plural, timeAgo } from "@/lib/format";
import { FileThumb } from "./files/file-thumb";
import { Icon } from "./icon";

type FileStats = NonNullable<Stats["files"]>;
type KeyStats = NonNullable<Stats["apiKeys"]>;
type HostingStats = NonNullable<Stats["hosting"]>;
type UserStats = NonNullable<Stats["users"]>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHOWN_KEYS = 5;

function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-5 border border-border">
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-medium text-foreground">{title}</Text>
          <Text className="font-normal text-sm text-muted">{description}</Text>
        </View>
        {aside}
      </View>
      {children}
    </Card>
  );
}

/** The large number in a card's top corner. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-end">
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="font-normal text-xs text-muted">{label}</Text>
    </View>
  );
}

function StatHeading({ label, icon }: { label: string; icon: LucideIcon }) {
  return (
    <View className="flex-row items-center gap-2">
      <Text numberOfLines={1} className="flex-1 text-sm font-medium text-muted">
        {label}
      </Text>
      <Icon icon={icon} size={16} className="text-muted" />
    </View>
  );
}

/** A thin bar showing `share` (0 to 1) of its track. */
function ShareBar({
  share,
  className = "bg-chart",
}: {
  share: number;
  className?: string;
}) {
  return (
    <View className="h-1 overflow-hidden rounded-full bg-default">
      <View
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.min(Math.max(share, 0), 1) * 100}%` }}
      />
    </View>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn("size-2 rounded-full", className)} />
      <Text className="font-normal text-xs text-muted">{label}</Text>
    </View>
  );
}

/** One bar per day, oldest first, labelled at both ends. */
function DailyBars({ days }: { days: { date: string; value: number }[] }) {
  const peak = Math.max(...days.map((day) => day.value), 1);
  const first = days[0];
  const last = days.at(-1);

  return (
    <View className="gap-2">
      <View className="h-20 flex-row items-end gap-0.5">
        {days.map((day) => (
          <View key={day.date} className="h-full flex-1 justify-end">
            <View
              className={cn(
                "w-full rounded-sm",
                day.value > 0 ? "bg-chart" : "bg-default",
              )}
              style={{ height: `${Math.max((day.value / peak) * 100, 4)}%` }}
            />
          </View>
        ))}
      </View>
      {first && last ? (
        <View className="flex-row justify-between">
          <Text className="font-normal text-xs text-muted">
            {formatDay(first.date)}
          </Text>
          <Text className="font-normal text-xs text-muted">
            {formatDay(last.date)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type AlertTarget = "files" | "activity" | "keys";

const TONES = {
  danger: { badge: "bg-danger-soft", icon: "text-danger" },
  warning: { badge: "bg-warning-soft", icon: "text-warning" },
  neutral: { badge: "bg-default", icon: "text-muted" },
};

type AlertView = {
  tone: (typeof TONES)[keyof typeof TONES];
  icon: LucideIcon;
  title: string;
  detail: string;
  target: AlertTarget;
};

// mirrors describe() in the web dashboard's alerts
function describeAlert(alert: StatsAlert): AlertView | null {
  switch (alert.type) {
    case "storage-low":
      return {
        tone: TONES.danger,
        icon: HardDrive,
        title: "Storage is running low",
        detail: `${formatBytes(alert.available)} free of ${formatBytes(alert.capacity)}. Uploads fail once the volume is full.`,
        target: "files",
      };
    case "uploads-failed":
      return {
        tone: TONES.danger,
        icon: CircleX,
        title: `${plural(alert.count, "upload")} failed this week`,
        detail: `The latest failed ${timeAgo(alert.latest)}.`,
        target: "activity",
      };
    case "deletes-failed":
      return {
        tone: TONES.danger,
        icon: Trash2,
        title: `${plural(alert.count, "deletion")} failed this week`,
        detail: `Some files or folders weren't removed. The latest failed ${timeAgo(alert.latest)}.`,
        target: "activity",
      };
    case "keys-expired":
      return {
        tone: TONES.danger,
        icon: TimerOff,
        title: `${plural(alert.count, "API key")} expired`,
        detail:
          "Requests made with them are refused. Delete them or create replacements.",
        target: "keys",
      };
    case "keys-expiring":
      return {
        tone: TONES.warning,
        icon: KeyRound,
        title: `${plural(alert.count, "API key")} ${alert.count === 1 ? "expires" : "expire"} within 7 days`,
        detail: "Create replacements before the apps using them lose access.",
        target: "keys",
      };
    case "keys-unused":
      return {
        tone: TONES.neutral,
        icon: KeyRound,
        title: `${plural(alert.count, "API key")} unused for 30 days`,
        detail: "Delete keys you no longer need, so they can't leak.",
        target: "keys",
      };
    default:
      // a newer server may send types this build doesn't know
      return null;
  }
}

export function AlertsCard({
  alerts,
  onOpen,
}: {
  alerts: StatsAlert[];
  onOpen: (target: AlertTarget) => void;
}) {
  const views = alerts
    .map(describeAlert)
    .filter((view): view is AlertView => view !== null);
  if (views.length === 0) return null;

  return (
    <Card className="gap-1 border border-border p-2">
      {views.map((view) => (
        <Pressable
          key={view.title}
          onPress={() => onOpen(view.target)}
          accessibilityRole="link"
          className="flex-row items-center gap-3 rounded-xl p-2 active:bg-default"
        >
          <View
            className={cn(
              "size-9 items-center justify-center rounded-full",
              view.tone.badge,
            )}
          >
            <Icon icon={view.icon} size={18} className={view.tone.icon} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-medium text-foreground">
              {view.title}
            </Text>
            <Text className="font-normal text-xs text-muted">
              {view.detail}
            </Text>
          </View>
          <Icon icon={ChevronRight} size={18} className="text-muted" />
        </Pressable>
      ))}
    </Card>
  );
}

export function StorageCard({ storage }: { storage: FileStats["storage"] }) {
  const { used, available, capacity } = storage;
  // servers that predate `capacity` only say how much is free
  const total = capacity && capacity > 0 ? capacity : used + available;
  const other = capacity ? Math.max(capacity - available - used, 0) : 0;
  const share = (bytes: number) => (total > 0 ? (bytes / total) * 100 : 0);

  return (
    <Card className="gap-3 border border-border">
      <StatHeading label="Total storage" icon={HardDrive} />
      <Text className="text-2xl font-bold text-foreground">
        {formatBytes(used)}
      </Text>
      <View className="h-2 flex-row overflow-hidden rounded-full bg-default">
        <View
          className="h-full bg-chart"
          style={{ width: `${used > 0 ? Math.max(share(used), 1) : 0}%` }}
        />
        <View
          className="h-full bg-muted"
          style={{ width: `${share(other)}%` }}
        />
      </View>
      {capacity ? (
        <View className="flex-row flex-wrap gap-x-3 gap-y-1">
          <LegendDot className="bg-chart" label="Files" />
          {other > 0 ? (
            <LegendDot className="bg-muted" label="Other data" />
          ) : null}
          <LegendDot className="border border-border bg-default" label="Free" />
        </View>
      ) : null}
      <Text className="font-normal text-xs text-muted">
        {capacity
          ? `${formatBytes(available)} free of ${formatBytes(capacity)}`
          : `${formatBytes(available)} free on the server`}
      </Text>
    </Card>
  );
}

export function StatTile({
  icon,
  label,
  value,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 active:opacity-80"
      accessibilityRole={onPress ? "link" : undefined}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Card className="flex-1 gap-2 border border-border p-3.5">
        <StatHeading label={label} icon={icon} />
        <Text className="text-2xl font-bold text-foreground">
          {value.toLocaleString()}
        </Text>
      </Card>
    </Pressable>
  );
}

export function TypeBreakdown({ types }: { types: FileStats["types"] }) {
  const groups = new Map<FileKind, { size: number; count: number }>();
  for (const type of types) {
    const kind = fileKind("", type.mimeType);
    const group = groups.get(kind) ?? { size: 0, count: 0 };
    groups.set(kind, {
      size: group.size + type.size,
      count: group.count + type.count,
    });
  }

  const sorted = [...groups.entries()].sort((a, b) => b[1].size - a[1].size);
  const total = sorted.reduce((sum, [, group]) => sum + group.size, 0);
  if (total === 0) return null;

  return (
    <Section
      title="Storage by type"
      description="Breakdown of storage by file type"
    >
      <View className="h-3 flex-row gap-0.5 overflow-hidden rounded-full">
        {sorted
          .filter(([, group]) => group.size > 0)
          .map(([kind, group]) => (
            <View
              key={kind}
              className={KIND_INFO[kind].bar}
              style={{ flex: group.size / total }}
            />
          ))}
      </View>
      <View className="gap-3">
        {sorted.map(([kind, group]) => (
          <View key={kind} className="flex-row items-center gap-3">
            <View
              className={cn("size-2.5 rounded-full", KIND_INFO[kind].bar)}
            />
            <Text className="font-normal flex-1 text-sm text-foreground">
              {KIND_INFO[kind].label}
            </Text>
            <Text className="font-normal text-sm text-muted">
              {group.count.toLocaleString()} · {formatBytes(group.size)}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

export type FileRow = {
  file: File;
  /** Second line under the name; ignored when `share` is set. */
  meta?: string;
  /** Draws a bar under the name instead of `meta`. */
  share?: number;
  aside: string;
};

export function FileListCard({
  title,
  description,
  rows,
  onOpen,
}: {
  title: string;
  description: string;
  rows: FileRow[];
  onOpen: (file: File) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <Section title={title} description={description}>
      <View className="gap-1">
        {rows.map(({ file, meta, share, aside }) => (
          <Pressable
            key={file.id}
            onPress={() => onOpen(file)}
            className="-mx-2 flex-row items-center gap-3 rounded-xl px-2 py-1.5 active:bg-default"
          >
            <FileThumb file={file} size={36} />
            <View className="flex-1 gap-1">
              <Text
                numberOfLines={1}
                className="font-normal text-sm text-foreground"
              >
                {file.name}
              </Text>
              {share !== undefined ? (
                <ShareBar share={share} />
              ) : meta ? (
                <Text
                  numberOfLines={1}
                  className="font-normal text-xs text-muted"
                >
                  {meta}
                </Text>
              ) : null}
            </View>
            {/* a fixed width lines the bars up when they are shown */}
            <Text
              className={cn(
                "font-normal text-xs text-muted",
                share !== undefined && "w-16 text-right",
              )}
            >
              {aside}
            </Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

/** The folder a file sits in, as the file browser names it. */
export function folderOf(file: File) {
  return file.key.includes("/")
    ? file.key.slice(0, file.key.lastIndexOf("/"))
    : "All files";
}

export function TrafficCard({ hosting }: { hosting: HostingStats }) {
  const requests = hosting.days.reduce((sum, day) => sum + day.requests, 0);
  const bytes = hosting.days.reduce((sum, day) => sum + day.bytes, 0);
  const notFound = hosting.days.reduce((sum, day) => sum + day.notFound, 0);

  return (
    <Section
      title="Hosting traffic"
      description="Requests to your hosted files, last 30 days"
      aside={
        <Figure
          value={requests.toLocaleString()}
          label={`${formatBytes(bytes)} served`}
        />
      }
    >
      {requests > 0 || notFound > 0 ? (
        <DailyBars
          days={hosting.days.map((day) => ({
            date: day.date,
            value: day.requests,
          }))}
        />
      ) : null}
      <Text className="font-normal text-xs text-muted">
        {requests === 0 && notFound === 0
          ? "No requests in the last 30 days. "
          : notFound > 0
            ? `${plural(notFound, "request")} found nothing, such as broken links or private files asked for without a signed link. `
            : ""}
        Views from the app and the dashboard aren't counted.
      </Text>
    </Section>
  );
}

export function FilesAddedCard({
  added,
}: {
  added: NonNullable<FileStats["added"]>;
}) {
  const count = added.reduce((sum, day) => sum + day.count, 0);
  const size = added.reduce((sum, day) => sum + day.size, 0);
  if (count === 0) return null;

  return (
    <Section
      title="Files added"
      description="New uploads in the last 30 days, of the files still stored"
      aside={
        <Figure value={count.toLocaleString()} label={formatBytes(size)} />
      }
    >
      <DailyBars
        days={added.map((day) => ({ date: day.date, value: day.count }))}
      />
    </Section>
  );
}

const VISIBILITY_INFO = {
  public: {
    label: "Public",
    hint: "Anyone with the link can open these",
    icon: Globe,
    bar: "bg-chart",
  },
  private: {
    label: "Private",
    hint: "Need a signed link, an API key or an account",
    icon: Lock,
    bar: "bg-kind-image",
  },
} as const;

export function VisibilityCard({
  visibility,
}: {
  visibility: NonNullable<FileStats["visibility"]>;
}) {
  const total = visibility.public.count + visibility.private.count;
  if (total === 0) return null;

  return (
    <Section
      title="Visibility"
      description="How many of your files anyone on the internet can read"
    >
      <View className="h-3 flex-row gap-0.5 overflow-hidden rounded-full bg-default">
        {(["public", "private"] as const)
          .filter((key) => visibility[key].count > 0)
          .map((key) => (
            <View
              key={key}
              className={VISIBILITY_INFO[key].bar}
              style={{ flex: visibility[key].count / total }}
            />
          ))}
      </View>
      <View className="gap-4">
        {(["public", "private"] as const).map((key) => {
          const info = VISIBILITY_INFO[key];
          return (
            <View key={key} className="flex-row items-start gap-3">
              <View className={cn("mt-1.5 size-2.5 rounded-full", info.bar)} />
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Icon icon={info.icon} size={14} className="text-muted" />
                  <Text className="font-normal text-sm text-foreground">
                    {info.label}
                  </Text>
                </View>
                <Text className="font-normal text-xs text-muted">
                  {info.hint}
                </Text>
              </View>
              <Text className="font-normal text-sm text-muted">
                {visibility[key].count.toLocaleString()} ·{" "}
                {formatBytes(visibility[key].size)}
              </Text>
            </View>
          );
        })}
      </View>
    </Section>
  );
}

function KeyUsageRow({
  name,
  detail,
  requests,
  share,
  muted,
}: {
  name: string;
  detail?: string;
  requests: number;
  share: number;
  muted?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-3">
        <Text
          numberOfLines={1}
          className={cn(
            "flex-1 text-sm",
            muted ? "font-normal text-muted" : "font-medium text-foreground",
          )}
        >
          {name}
        </Text>
        {detail ? (
          <Text className="font-normal text-xs text-muted">{detail}</Text>
        ) : null}
        <Text className="font-normal w-12 text-right text-sm text-foreground">
          {requests.toLocaleString()}
        </Text>
      </View>
      <ShareBar share={share} className={muted ? "bg-muted" : undefined} />
    </View>
  );
}

export function RequestsChart({ apiKeys }: { apiKeys: KeyStats }) {
  const total = apiKeys.requests.reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(...apiKeys.requests.map((day) => day.count), 1);

  // servers that predate per-key usage leave `keys` out
  const keys = apiKeys.keys;
  const fromDeleted = keys
    ? total - keys.reduce((sum, key) => sum + key.requests, 0)
    : 0;
  const busiest = Math.max(
    fromDeleted,
    ...(keys ?? []).map((key) => key.requests),
    1,
  );

  return (
    <Section
      title="API requests"
      description="Daily usage of your API keys"
      aside={<Figure value={total.toLocaleString()} label="This week" />}
    >
      <View className="h-28 flex-row items-end gap-2">
        {apiKeys.requests.map((day) => (
          <View key={day.date} className="flex-1 items-center gap-2">
            <View className="w-full flex-1 justify-end">
              <View
                className={cn(
                  "w-full rounded-md",
                  day.count > 0 ? "bg-chart" : "bg-default",
                )}
                style={{ height: `${Math.max((day.count / peak) * 100, 4)}%` }}
              />
            </View>
            <Text className="font-normal text-xs text-muted">
              {WEEKDAYS[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}
            </Text>
          </View>
        ))}
      </View>
      {keys && (keys.length > 0 || fromDeleted > 0) ? (
        <View className="gap-3">
          {keys.slice(0, SHOWN_KEYS).map((key) => (
            <KeyUsageRow
              key={key.id}
              name={key.name}
              detail={
                key.lastUsed ? `Used ${timeAgo(key.lastUsed)}` : "Never used"
              }
              requests={key.requests}
              share={key.requests / busiest}
            />
          ))}
          {fromDeleted > 0 ? (
            <KeyUsageRow
              name="Deleted keys"
              requests={fromDeleted}
              share={fromDeleted / busiest}
              muted
            />
          ) : null}
          {keys.length > SHOWN_KEYS ? (
            <Text className="font-normal text-xs text-muted">
              {plural(keys.length - SHOWN_KEYS, "more key")}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Section>
  );
}

export function UsersCard({
  users,
  onPress,
}: {
  users: UserStats;
  onPress: () => void;
}) {
  const figures = [
    { label: "Accounts", value: users.total },
    { label: "Disabled", value: users.disabled },
    { label: "Devices signed in", value: users.sessions },
  ];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="active:opacity-80"
    >
      <Section
        title="Users"
        description="Accounts on this server"
        aside={<Icon icon={ChevronRight} size={18} className="text-muted" />}
      >
        <View className="flex-row gap-3">
          {figures.map((figure) => (
            <View key={figure.label} className="flex-1 gap-1">
              <Text className="text-xl font-bold text-foreground">
                {figure.value.toLocaleString()}
              </Text>
              <Text className="font-normal text-xs text-muted">
                {figure.label}
              </Text>
            </View>
          ))}
        </View>
      </Section>
    </Pressable>
  );
}
