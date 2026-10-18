import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBytes, parseTimestamp } from "@/utils";
import type { StatsAlert } from "@repo/types";
import { formatDistanceToNow } from "date-fns";
import {
  CircleX,
  HardDrive,
  KeyRound,
  TimerOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { plural } from "./helpers";

// the activity page's red, amber and zinc badges
const TONES = {
  danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};

interface AlertView {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: string;
  detail: string;
  action: { label: string; href: string };
}

const ago = (value: string) =>
  formatDistanceToNow(parseTimestamp(value), { addSuffix: true });

// mirrored in the mobile app's overview, so both read the same
function describe(alert: StatsAlert): AlertView | null {
  switch (alert.type) {
    case "storage-low":
      return {
        tone: "danger",
        icon: HardDrive,
        title: "Storage is running low",
        detail: `${formatBytes(alert.available)} free of ${formatBytes(alert.capacity)}. Uploads fail once the volume is full.`,
        action: { label: "Open files", href: "/dashboard/files" },
      };
    case "uploads-failed":
      return {
        tone: "danger",
        icon: CircleX,
        title: `${plural(alert.count, "upload")} failed this week`,
        detail: `The latest failed ${ago(alert.latest)}.`,
        action: { label: "View activity", href: "/dashboard/activity" },
      };
    case "deletes-failed":
      return {
        tone: "danger",
        icon: Trash2,
        title: `${plural(alert.count, "deletion")} failed this week`,
        detail: `Some files or folders weren't removed. The latest failed ${ago(alert.latest)}.`,
        action: { label: "View activity", href: "/dashboard/activity" },
      };
    case "keys-expired":
      return {
        tone: "danger",
        icon: TimerOff,
        title: `${plural(alert.count, "API key")} expired`,
        detail:
          "Requests made with them are refused. Delete them or create replacements.",
        action: { label: "Manage keys", href: "/dashboard/api-keys" },
      };
    case "keys-expiring":
      return {
        tone: "warning",
        icon: KeyRound,
        title: `${plural(alert.count, "API key")} ${alert.count === 1 ? "expires" : "expire"} within 7 days`,
        detail: "Create replacements before the apps using them lose access.",
        action: { label: "Manage keys", href: "/dashboard/api-keys" },
      };
    case "keys-unused":
      return {
        tone: "neutral",
        icon: KeyRound,
        title: `${plural(alert.count, "API key")} unused for 30 days`,
        detail: "Delete keys you no longer need, so they can't leak.",
        action: { label: "Manage keys", href: "/dashboard/api-keys" },
      };
    default:
      return null;
  }
}

export default function Alerts({ alerts }: { alerts: StatsAlert[] }) {
  const views = alerts
    .map(describe)
    .filter((view): view is AlertView => view !== null);

  if (views.length === 0) return null;

  return (
    <section
      aria-label="Needs attention"
      className="border-border/50 bg-card/50 divide-border/50 divide-y rounded-xl border"
    >
      {views.map((view) => (
        <div
          key={view.title}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={cn("shrink-0 rounded-full p-2", TONES[view.tone])}>
              <view.icon className="size-4" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">{view.title}</p>
              <p className="text-muted-foreground text-sm">{view.detail}</p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="self-start sm:self-center"
          >
            <Link href={view.action.href}>{view.action.label}</Link>
          </Button>
        </div>
      ))}
    </section>
  );
}
