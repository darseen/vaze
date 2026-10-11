import { cn } from "@/lib/utils";
import ApiKeys from "./api-keys";
import TotalFiles from "./total-files";
import TotalFolders from "./total-folders";
import TotalStorage from "./total-storage";

export default function StatsCards({
  files,
  apiKeysOf,
}: {
  files: boolean;
  apiKeysOf: string | null;
}) {
  return (
    <section
      className={cn(
        "grid gap-4",
        files && apiKeysOf
          ? "md:grid-cols-2 lg:grid-cols-4"
          : files
            ? "md:grid-cols-3"
            : "md:grid-cols-4",
      )}
    >
      {files && (
        <>
          <TotalStorage />
          <TotalFiles />
          <TotalFolders />
        </>
      )}
      {apiKeysOf && <ApiKeys userId={apiKeysOf} />}
    </section>
  );
}
