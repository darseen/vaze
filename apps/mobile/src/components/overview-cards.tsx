import type { File, Stats } from "@darseen/vaze";
import { Card, cn } from "heroui-native";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { fileKind, KIND_INFO, type FileKind } from "@/lib/file-kind";
import { formatBytes, timeAgo } from "@/lib/format";
import { FileThumb } from "./files/file-thumb";
import { Icon } from "./icon";

type FileStats = NonNullable<Stats["files"]>;
type KeyStats = NonNullable<Stats["apiKeys"]>;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-medium text-foreground">{title}</Text>
        {aside ? (
          <Text className="font-normal text-sm text-muted">{aside}</Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

export function StorageCard({ storage }: { storage: FileStats["storage"] }) {
  const total = storage.used + storage.available;
  const share = total > 0 ? storage.used / total : 0;

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text className="font-normal text-sm text-muted">Storage used</Text>
        <Text className="text-3xl font-semibold text-foreground">
          {formatBytes(storage.used)}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-default">
        <View
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.max(share * 100, 1)}%` }}
        />
      </View>
      <Text className="font-normal text-sm text-muted">
        {formatBytes(storage.available)} free on the server
      </Text>
    </Card>
  );
}

export function StatTile({
  icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex-1 gap-3">
      <Icon icon={icon} size={18} className="text-muted" />
      <View>
        <Text className="text-2xl font-semibold text-foreground">
          {value.toLocaleString()}
        </Text>
        <Text className="font-normal text-sm text-muted">{label}</Text>
      </View>
    </Card>
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
    <Section title="Storage by type">
      <View className="h-3 flex-row gap-0.5 overflow-hidden rounded-full">
        {sorted.map(([kind, group]) => (
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

export function FileListCard({
  title,
  files,
  detail,
  onOpen,
}: {
  title: string;
  files: File[];
  detail: "time" | "size";
  onOpen: (file: File) => void;
}) {
  if (files.length === 0) return null;
  const largest = Math.max(...files.map((file) => file.size), 1);

  return (
    <Section title={title}>
      <View className="gap-1">
        {files.map((file) => (
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
              {detail === "size" ? (
                <View className="h-1 overflow-hidden rounded-full bg-default">
                  <View
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(file.size / largest) * 100}%` }}
                  />
                </View>
              ) : (
                <Text
                  numberOfLines={1}
                  className="font-normal text-xs text-muted"
                >
                  {file.key.includes("/")
                    ? file.key.slice(0, file.key.lastIndexOf("/"))
                    : "All files"}
                </Text>
              )}
            </View>
            <Text className="font-normal text-xs text-muted">
              {detail === "size"
                ? formatBytes(file.size)
                : timeAgo(file.createdAt)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

export function RequestsChart({ apiKeys }: { apiKeys: KeyStats }) {
  const total = apiKeys.requests.reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(...apiKeys.requests.map((day) => day.count), 1);

  return (
    <Section title="API requests" aside={`${total.toLocaleString()} this week`}>
      <View className="h-28 flex-row items-end gap-2">
        {apiKeys.requests.map((day) => (
          <View key={day.date} className="flex-1 items-center gap-2">
            <View className="w-full flex-1 justify-end">
              <View
                className={cn(
                  "w-full rounded-md",
                  day.count > 0 ? "bg-accent" : "bg-default",
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
    </Section>
  );
}
