import { Metadata } from "next";
import { connection } from "next/server";
import { History } from "lucide-react";
import ActivityList from "./_components/activity-list";
import fetchActivities from "./_utils/fetch-activities";

export const metadata: Metadata = {
  title: "Activity",
  description: "Vaze | Review recent uploads and API key changes.",
};

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  const { data, error } = await fetchActivities();

  if (error) throw error;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <History className="text-primary h-8 w-8" />
          <h1 className="text-foreground text-3xl font-bold">Activity</h1>
        </div>
        <p className="text-muted-foreground text-balance">
          A history of uploads and API key changes. Delete what you no longer
          need — entries are pruned automatically after a while.
        </p>
      </div>

      <ActivityList activities={data.activities} />
    </div>
  );
}
