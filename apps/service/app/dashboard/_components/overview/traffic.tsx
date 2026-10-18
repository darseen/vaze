import { formatBytes } from "@/utils";
import type { Stats } from "@repo/types";
import DailyChart from "./daily-chart";
import FileRows from "./file-rows";
import { folderOf, formatDay, plural } from "./helpers";
import { Empty, Figure, Panel } from "./panel";

type Hosting = NonNullable<Stats["hosting"]>;

const UNCOUNTED = "Views from the dashboard and the mobile app aren't counted.";

export function HostingTraffic({ hosting }: { hosting: Hosting }) {
  const requests = hosting.days.reduce((sum, day) => sum + day.requests, 0);
  const bytes = hosting.days.reduce((sum, day) => sum + day.bytes, 0);
  const notFound = hosting.days.reduce((sum, day) => sum + day.notFound, 0);

  return (
    <Panel
      title="Hosting Traffic"
      description="Requests to your hosted files over the last 30 days"
      aside={
        <Figure
          value={requests.toLocaleString("en-US")}
          label={`${formatBytes(bytes)} served`}
        />
      }
    >
      {requests === 0 && notFound === 0 ? (
        <Empty>
          <p>No requests in the last 30 days</p>
          <p className="text-xs">{UNCOUNTED}</p>
        </Empty>
      ) : (
        <div className="space-y-3">
          <DailyChart
            variant="area"
            name="Requests"
            data={hosting.days.map((day) => ({
              date: day.date,
              tick: formatDay(day.date),
              label: formatDay(day.date),
              value: day.requests,
              details: [
                plural(day.requests, "request"),
                `${formatBytes(day.bytes)} served`,
                `${day.notFound.toLocaleString("en-US")} not found`,
              ],
            }))}
          />
          <p className="text-muted-foreground text-xs">
            {notFound > 0
              ? `${plural(notFound, "request")} found nothing, such as broken links or private files asked for without a signed link. `
              : ""}
            {UNCOUNTED}
          </p>
        </div>
      )}
    </Panel>
  );
}

export function TopRequested({ top }: { top: Hosting["top"] }) {
  return (
    <Panel
      title="Most Requested Files"
      description="Hosted files fetched the most over the last 30 days"
    >
      {top.length === 0 ? (
        <Empty>Nothing has been requested yet</Empty>
      ) : (
        <FileRows
          rows={top.map(({ file, requests, bytes }) => ({
            file,
            meta: folderOf(file.key),
            aside: plural(requests, "request"),
            asideDetail: `${formatBytes(bytes)} served`,
          }))}
        />
      )}
    </Panel>
  );
}
