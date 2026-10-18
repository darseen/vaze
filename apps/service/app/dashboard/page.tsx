import { Card, CardContent } from "@/components/ui/card";
import { scopesOf } from "@/lib/permissions";
import { getStats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import auth from "@/utils/auth";
import { LayoutDashboard } from "lucide-react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Alerts from "./_components/overview/alerts";
import ApiRequests from "./_components/overview/api-requests";
import {
  FilesAdded,
  LargestFiles,
  RecentFiles,
  TypeBreakdown,
  Visibility,
} from "./_components/overview/files";
import Tiles from "./_components/overview/tiles";
import { HostingTraffic, TopRequested } from "./_components/overview/traffic";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Stats are read live from the database on every request; without this the
// route would be statically prerendered at build time against an empty DB.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await auth();
  if (!user) redirect("/");

  const scopes = scopesOf(user);

  if (!scopes.includes("files:read") && !scopes.includes("api-keys:manage")) {
    return (
      <Card className="mx-auto w-full max-w-xl border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-muted mb-3 rounded-full p-3">
            <LayoutDashboard className="text-muted-foreground h-6 w-6" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-semibold">
            Nothing to show yet
          </h3>
          <p className="text-muted-foreground max-w-sm text-sm">
            Your account can&apos;t see files or use API keys. Ask an admin for
            access.
          </p>
        </CardContent>
      </Card>
    );
  }

  // the same numbers /api/stats returns to the SDK and the mobile app
  const stats = await getStats({ userId: user.id, scopes, session: true });
  const { files, apiKeys, hosting } = stats;

  // paired two by two on wide screens
  const panels: ReactNode[] = [];
  if (hosting) panels.push(<HostingTraffic key="traffic" hosting={hosting} />);
  if (files?.added) panels.push(<FilesAdded key="added" added={files.added} />);
  if (files) panels.push(<RecentFiles key="recent" files={files.recent} />);
  if (hosting) panels.push(<TopRequested key="top" top={hosting.top} />);
  if (apiKeys) panels.push(<ApiRequests key="api" apiKeys={apiKeys} />);
  if (files) {
    panels.push(
      <TypeBreakdown key="types" types={files.types} />,
      <LargestFiles key="largest" files={files.largest} />,
    );
  }
  if (files?.visibility) {
    panels.push(<Visibility key="visibility" visibility={files.visibility} />);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Alerts alerts={stats.alerts ?? []} />

      <Tiles stats={stats} />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {panels.map((panel, index) => (
          <div
            key={index}
            className={cn(
              "min-w-0",
              // an odd panel out takes the whole last row
              index === panels.length - 1 &&
                panels.length % 2 === 1 &&
                "md:col-span-2",
            )}
          >
            {panel}
          </div>
        ))}
      </section>
    </div>
  );
}
