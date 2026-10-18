import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils";
import type { Stats } from "@repo/types";
import {
  FileText,
  FolderOpen,
  HardDrive,
  Key,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { plural } from "./helpers";

type FileStats = NonNullable<Stats["files"]>;

function Tile({
  title,
  icon: Icon,
  value,
  detail,
  href,
  children,
}: {
  title: string;
  icon: LucideIcon;
  value: string;
  detail: string;
  href?: string;
  children?: ReactNode;
}) {
  const card = (
    <Card
      className={cn(
        "border-border/50 bg-card/50 h-full gap-3",
        href &&
          "transition-all duration-500 hover:scale-[1.02] hover:border-amber-400",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-2xl font-bold">{value}</p>
        {children}
        <p className="text-muted-foreground text-xs">{detail}</p>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="rounded-xl">
      {card}
    </Link>
  ) : (
    card
  );
}

function StorageTile({ storage }: { storage: FileStats["storage"] }) {
  const { used, available, capacity = 0 } = storage;
  // whatever else lives on the volume: the database, thumbnails, other apps
  const other = Math.max(capacity - available - used, 0);
  const share = (bytes: number) =>
    capacity > 0 ? (bytes / capacity) * 100 : 0;

  return (
    <Tile
      title="Storage"
      icon={HardDrive}
      value={formatBytes(used)}
      detail={
        capacity > 0
          ? `${formatBytes(available)} free of ${formatBytes(capacity)}`
          : `${formatBytes(available)} free`
      }
    >
      {capacity > 0 && (
        <>
          <div
            role="img"
            aria-label={`Files ${formatBytes(used)}, other data ${formatBytes(other)}, free ${formatBytes(available)}`}
            className="bg-muted flex h-2 overflow-hidden rounded-full"
          >
            <div
              className="bg-usage h-full"
              title={`Files: ${formatBytes(used)}`}
              style={{ width: `${used > 0 ? Math.max(share(used), 1) : 0}%` }}
            />
            <div
              className="bg-muted-foreground/40 h-full"
              title={`Other data on the volume: ${formatBytes(other)}`}
              style={{ width: `${share(other)}%` }}
            />
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-usage size-2 rounded-full" /> Files
            </span>
            {other > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="bg-muted-foreground/40 size-2 rounded-full" />
                Other data
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="bg-muted size-2 rounded-full border" /> Free
            </span>
          </div>
        </>
      )}
    </Tile>
  );
}

const GRID_COLUMNS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
  5: "md:grid-cols-3 lg:grid-cols-5",
};

export default function Tiles({ stats }: { stats: Stats }) {
  const { files, apiKeys, users } = stats;
  const tiles: ReactNode[] = [];

  if (files) {
    tiles.push(
      <StorageTile key="storage" storage={files.storage} />,
      <Tile
        key="files"
        title="Files"
        icon={FileText}
        value={files.total.toLocaleString("en-US")}
        detail={
          files.visibility
            ? `${files.visibility.public.count.toLocaleString("en-US")} public · ${files.visibility.private.count.toLocaleString("en-US")} private`
            : "Files uploaded"
        }
        href="/dashboard/files"
      />,
      <Tile
        key="folders"
        title="Folders"
        icon={FolderOpen}
        // the root folder always exists, so it isn't one anybody made
        value={Math.max(files.folders - 1, 0).toLocaleString("en-US")}
        detail="Not counting the root"
        href="/dashboard/files"
      />,
    );
  }

  if (apiKeys) {
    const week = apiKeys.requests.reduce((sum, day) => sum + day.count, 0);
    tiles.push(
      <Tile
        key="keys"
        title="API Keys"
        icon={Key}
        value={apiKeys.total.toLocaleString("en-US")}
        detail={`${plural(week, "request")} this week`}
        href="/dashboard/api-keys"
      />,
    );
  }

  if (users) {
    const signedIn = `${plural(users.sessions, "device")} signed in`;
    tiles.push(
      <Tile
        key="users"
        title="Users"
        icon={Users}
        value={users.total.toLocaleString("en-US")}
        detail={
          users.disabled > 0
            ? `${users.disabled.toLocaleString("en-US")} disabled · ${signedIn}`
            : signedIn
        }
        href="/dashboard/users"
      />,
    );
  }

  if (tiles.length === 0) return null;

  return (
    <section
      className={cn("grid grid-cols-1 gap-4", GRID_COLUMNS[tiles.length])}
    >
      {tiles}
    </section>
  );
}
