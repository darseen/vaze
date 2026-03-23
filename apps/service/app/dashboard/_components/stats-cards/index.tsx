import ApiKeys from "./api-keys";
import TotalFiles from "./total-files";
import TotalFolders from "./total-folders";
import TotalStorage from "./total-storage";

export default function StatsCards() {
  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <TotalStorage />
      <TotalFiles />
      <TotalFolders />
      <ApiKeys />
    </section>
  );
}
