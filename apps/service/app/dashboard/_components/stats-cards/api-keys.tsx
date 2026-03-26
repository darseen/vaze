import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import db from "@/db";
import { Key } from "lucide-react";

export default async function ApiKeys() {
  const totalApiKeys = db
    .prepare("SELECT COUNT(*) AS count FROM api_keys")
    .get() as { count: number };

  const stats = {
    title: "API Keys",
    value: totalApiKeys.count,
    icon: Key,
    description: "Active keys",
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
