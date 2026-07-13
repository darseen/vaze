import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import { parseTimestamp } from "@/utils";
import Chart from "./chart";

export default function ApiRequestsChart() {
  // Only the last 7 days, so the "this week" total and the per-weekday buckets
  // actually line up (and we don't load the entire table into memory).
  const result = db
    .prepare(
      "SELECT created_at FROM api_requests WHERE created_at >= date('now', '-6 days')",
    )
    .all() as { created_at: string }[];

  const totalRequests = result.length;

  // Pre-seed one bucket per day for the last 7 days, in chronological order,
  // keyed by local calendar date.
  const buckets = new Map<string, { dayOfTheWeek: string; requests: number }>();
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const key = day.toLocaleDateString("en-US");
    buckets.set(key, {
      dayOfTheWeek: day.toLocaleDateString("en-US", { weekday: "short" }),
      requests: 0,
    });
  }

  result.forEach((item) => {
    const key = parseTimestamp(item.created_at).toLocaleDateString("en-US");
    const bucket = buckets.get(key);
    if (bucket) bucket.requests += 1;
  });

  const data = Array.from(buckets.values());

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">
              API Requests
            </CardTitle>
            <CardDescription>Daily API key usage</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">
              {totalRequests.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-xs">Total this week</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex h-64 items-center justify-center">
        {totalRequests === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No API requests yet
          </p>
        ) : (
          <Chart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
