import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import Chart from "./chart";

export default async function FileTypesChart() {
  const result = db
    .prepare(
      "SELECT type AS name, SUM(size) AS value FROM files GROUP BY type ORDER BY value DESC",
    )
    .all() as { name: string; value: number }[];

  const palette = [
    "oklch(0.7 0.15 220)", // Blue
    "oklch(0.7 0.15 160)", // Green
    "oklch(0.75 0.15 45)", // Orange
    "oklch(0.65 0.2 280)", // Purple
    "oklch(0.6 0.2 25)", // Red
    "oklch(0.75 0.15 90)", // Yellow
  ];

  const data = result.map((item, index) => ({
    name: item.name,
    value: item.value,
    color: palette[index % palette.length],
  }));

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Storage by File Type
        </CardTitle>
        <CardDescription>
          Breakdown of storage usage by file type
        </CardDescription>
      </CardHeader>
      <CardContent className="flex h-64 w-full items-center justify-center">
        {data.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No files uploaded yet
          </p>
        ) : (
          <Chart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
