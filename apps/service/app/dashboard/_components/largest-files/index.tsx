import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import db from "@/db";
import { files } from "@/db/schema";
import { desc } from "drizzle-orm";
import Chart from "./chart";

export default async function LargestFilesChart() {
  const data = db
    .select({ name: files.name, size: files.size })
    .from(files)
    .orderBy(desc(files.size))
    .limit(5)
    .all();

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
