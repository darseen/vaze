import { Card, CardContent } from "@/components/ui/card";
import { hasScope } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import auth from "@/utils/auth";
import { LayoutDashboard } from "lucide-react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import ApiRequestsChart from "./_components/api-requests";
import FileTypesChart from "./_components/file-types";
import LargestFilesChart from "./_components/largest-files";
import RecentFiles from "./_components/recent-files";
import StatsCards from "./_components/stats-cards";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Stats are read live from the database on every request; without this the
// route would be statically prerendered at build time against an empty DB.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await auth();
  if (!user) redirect("/");

  const canReadFiles = hasScope(user, "files:read");
  const canUseApi = hasScope(user, "api-keys:manage");

  if (!canReadFiles && !canUseApi) {
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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <StatsCards files={canReadFiles} apiKeysOf={canUseApi ? user.id : null} />

      <section
        className={cn(
          "grid gap-6",
          canReadFiles && canUseApi && "md:grid-cols-2",
        )}
      >
        {canReadFiles && <LargestFilesChart />}
        {canUseApi && <ApiRequestsChart userId={user.id} />}
      </section>

      {canReadFiles && (
        <section className="grid gap-6 md:grid-cols-2">
          <RecentFiles />
          <FileTypesChart />
        </section>
      )}
    </div>
  );
}
