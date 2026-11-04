import { listDeleted } from "@/lib/deleted";
import { getLimits } from "@/lib/settings";
import { authorize } from "@/utils/auth";
import { ArchiveRestore } from "lucide-react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import DeletedList from "./_components/deleted-list";

export const metadata: Metadata = {
  title: "Recently deleted",
  description: "Vaze | Restore deleted files and folders.",
};

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  const { error } = await authorize("files:read");
  if (error) redirect("/dashboard");

  const { deletedRetentionDays: days } = getLimits();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ArchiveRestore className="text-primary h-8 w-8" />
          <h1 className="text-foreground text-3xl font-bold">
            Recently deleted
          </h1>
        </div>
        <p className="text-muted-foreground text-balance">
          Deleted files and folders wait here for {days}{" "}
          {days === 1 ? "day" : "days"}, then they are removed for good.
          Restoring puts them back where they were.
        </p>
      </div>

      <DeletedList items={listDeleted()} retentionDays={days} />
    </div>
  );
}
