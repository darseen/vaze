import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BASE_DATA_PATH } from "@/constants";
import { formatBytes } from "@/utils";
import { getAvailableStorage, getDirectorySize } from "@/utils/storage";
import { HardDrive } from "lucide-react";

export default async function TotalStorage() {
  const [storageSize, availableStorage] = await Promise.all([
    getDirectorySize(BASE_DATA_PATH),
    getAvailableStorage(BASE_DATA_PATH),
  ]);

  const stats = {
    title: "Total Storage",
    usedStorage: formatBytes(storageSize),
    availableStorage: formatBytes(availableStorage),
    icon: HardDrive,
    description: "Used storage space",
  };

  return (
    <Card key={stats.title} className="border-border/50 bg-card/50">
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
