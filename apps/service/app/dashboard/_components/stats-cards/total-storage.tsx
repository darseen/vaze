import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BASE_DATA_PATH } from "@/constants";
import { db } from "@/db";
import { files } from "@repo/db";
import { formatBytes } from "@/utils";
import { getAvailableStorage } from "@/utils/storage";
import { sql } from "drizzle-orm";
import { HardDrive } from "lucide-react";

export default async function TotalStorage() {
  // summing the column beats walking the uploads tree on every render
  const usage = db
    .select({ total: sql<number | null>`sum(${files.size})` })
    .from(files)
    .get();

  const storageSize = usage?.total ?? 0;
  const availableStorage = await getAvailableStorage(BASE_DATA_PATH);

  const stats = {
    title: "Total Storage",
    usedStorage: formatBytes(storageSize),
    availableStorage: formatBytes(availableStorage),
    icon: HardDrive,
    description: "Used storage space",
  };

  return (
    <Card
      key={stats.title}
      className="border-border/50 bg-card/50 transition-all duration-500 hover:scale-[1.02] hover:border-amber-400"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {stats.title}
        </CardTitle>
        <stats.icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {stats.usedStorage} / {stats.availableStorage}
        </p>
        <p className="text-muted-foreground text-xs">{stats.description}</p>
      </CardContent>
    </Card>
  );
}
