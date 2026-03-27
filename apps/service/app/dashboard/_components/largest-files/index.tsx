import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import Chart from "./chart";

export default async function LargestFilesChart() {
  const data = db
    .prepare("SELECT name, size FROM files ORDER BY size DESC LIMIT 5")
    .all() as { name: string; size: number }[];

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-base font-medium">Largest Files</CardTitle>
        <CardDescription>
          Files consuming the most storage space
        </CardDescription>
      </CardHeader>
      <CardContent className="flex h-64 items-center justify-center">
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
