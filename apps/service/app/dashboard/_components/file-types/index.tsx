import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import { files } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import Chart from "./chart";

export default async function FileTypesChart() {
  const value = sql<number>`sum(${files.size})`;
  const result = db
    .select({ name: files.type, value })
    .from(files)
    .groupBy(files.type)
    .orderBy(desc(value))
    .all();

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
    fill: palette[index % palette.length],
  }));

  return (
    <Card className="border-border/50 bg-card/50 flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-base font-medium">
          Storage by File Type
        </CardTitle>
        <CardDescription>
          Breakdown of storage usage by file type
        </CardDescription>
      </CardHeader>
      <CardContent className="flex h-64 w-full flex-1 items-center justify-center pb-0">
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
