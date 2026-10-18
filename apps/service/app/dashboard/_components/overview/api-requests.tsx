import { Button } from "@/components/ui/button";
import { parseTimestamp } from "@/utils";
import type { Stats } from "@repo/types";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import DailyChart from "./daily-chart";
import { formatDay, plural } from "./helpers";
import { Empty, Figure, Panel, ShareBar } from "./panel";

type KeyStats = NonNullable<Stats["apiKeys"]>;

const SHOWN_KEYS = 5;

export default function ApiRequests({ apiKeys }: { apiKeys: KeyStats }) {
  const week = apiKeys.requests.reduce((sum, day) => sum + day.count, 0);
  const keys = apiKeys.keys ?? [];
  // requests made with keys deleted since keep counting toward the week
  const fromDeleted = week - keys.reduce((sum, key) => sum + key.requests, 0);
  const busiest = Math.max(fromDeleted, ...keys.map((key) => key.requests), 1);

  return (
    <Panel
      title="API Requests"
      description="Daily usage of your API keys over the last 7 days"
      aside={<Figure value={week.toLocaleString("en-US")} label="This week" />}
    >
      {apiKeys.total === 0 && week === 0 ? (
        <Empty>
          <p>No API keys yet</p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/dashboard/api-keys">Create a key</Link>
          </Button>
        </Empty>
      ) : (
        <div className="space-y-5">
          <DailyChart
            variant="bar"
            name="Requests"
            data={apiKeys.requests.map((day) => ({
              date: day.date,
              tick: formatDay(day.date, "weekday"),
              label: `${formatDay(day.date, "weekday")}, ${formatDay(day.date)}`,
              value: day.count,
              details: [plural(day.count, "request")],
            }))}
          />
          <ul className="space-y-3">
            {keys.slice(0, SHOWN_KEYS).map((key) => (
              <li key={key.id} className="space-y-1.5">
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {key.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {key.lastUsed
                      ? `Used ${formatDistanceToNow(parseTimestamp(key.lastUsed), { addSuffix: true })}`
                      : "Never used"}
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums">
                    {key.requests.toLocaleString("en-US")}
                  </span>
                </div>
                <ShareBar share={key.requests / busiest} />
              </li>
            ))}
            {fromDeleted > 0 && (
              <li className="space-y-1.5">
                <div className="flex items-baseline gap-3 text-sm">
                  <span className="text-muted-foreground flex-1">
                    Deleted keys
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums">
                    {fromDeleted.toLocaleString("en-US")}
                  </span>
                </div>
                <ShareBar
                  share={fromDeleted / busiest}
                  className="bg-muted-foreground/40"
                />
              </li>
            )}
          </ul>
          {keys.length > SHOWN_KEYS && (
            <Link
              href="/dashboard/api-keys"
              className="text-muted-foreground hover:text-foreground block text-xs underline-offset-4 hover:underline"
            >
              {plural(keys.length - SHOWN_KEYS, "more key")}
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}
