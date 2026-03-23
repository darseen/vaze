import { Metadata } from "next";
import ApiRequestsChart from "./_components/api-requests";
import FileTypesChart from "./_components/file-types";
import LargestFilesChart from "./_components/largest-files";
import RecentFiles from "./_components/recent-files";
import StatsCards from "./_components/stats-cards";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="bg-background min-h-screen">
      <main className="space-y-6 p-4 md:p-6 lg:p-8">
        <StatsCards />

        <section className="grid gap-6 md:grid-cols-2">
          <LargestFilesChart />
          <ApiRequestsChart />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <RecentFiles />
          <FileTypesChart />
        </section>
      </main>
    </div>
  );
}
