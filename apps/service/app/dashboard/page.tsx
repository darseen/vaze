import { Metadata } from "next";
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

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <StatsCards />

      <section className="grid gap-6 md:grid-cols-2">
        <LargestFilesChart />
        <ApiRequestsChart />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <RecentFiles />
        <FileTypesChart />
      </section>
    </div>
  );
}
