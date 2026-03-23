import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import Chart from "./chart";

export default function ApiRequestsChart() {
  const result = db
    .prepare("SELECT created_at FROM api_requests ORDER BY created_at ASC")
    .all() as { created_at: number }[];

  const totalRequests = result.length;

  const groupedData: Record<string, number> = {};

  result.forEach((item) => {
    const day = new Date(item.created_at).toLocaleDateString("en-US", {
      weekday: "short",
    });

    groupedData[day] = (groupedData[day] || 0) + 1;
  });

  const data = Object.entries(groupedData).map(([dayOfTheWeek, requests]) => ({
    dayOfTheWeek,
    requests,
  }));

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
        {data.length === 0 ? (
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
