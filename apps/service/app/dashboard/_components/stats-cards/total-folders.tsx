import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import db from "@/db";
import { folders } from "@/db/schema";
import { count } from "drizzle-orm";
import { FolderOpen } from "lucide-react";

export default async function TotalFolders() {
  const [{ value: totalFolders }] = db
    .select({ value: count() })
    .from(folders)
    .all();

  const stats = {
    title: "Total Folders",
    value: totalFolders,
    icon: FolderOpen,
    description: "Organized folders",
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
        <p className="text-2xl font-bold">{stats.value}</p>
        <p className="text-muted-foreground text-xs">{stats.description}</p>
      </CardContent>
    </Card>
  );
}
