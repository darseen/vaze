import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ComparisonPanel,
  directionOf,
  formatTimes,
  formatValue,
  Legend,
  SpeedupChart,
} from "@/components/benchmarks/charts";
import {
  allScenarios,
  benchmarkRun,
  memoryMB,
  publicSlowestMs,
  scenario,
  scenarioGroups,
  speedup,
} from "@/lib/benchmarks";
import { appName, benchmarksRoute, docsRoute } from "@/lib/shared";

export const metadata: Metadata = {
  title: "Benchmarks",
  description: `${appName} and Seafile measured on the same machine across sixteen everyday file operations: uploads, downloads, zips, folder listings and public links.`,
  alternates: {
    canonical: benchmarksRoute,
  },
};

// the scenarios whose CPU cost says the most about each server
const cpuPanels: { id: string; title: string }[] = [
  { id: "large_upload", title: "Receive one 1 GiB file" },
  { id: "large_download", title: "Send one 1 GiB file" },
  { id: "small_upload", title: "Receive 1,000 small files" },
  { id: "small_download", title: "Send 1,000 small files" },
  { id: "album_zip", title: "Zip 500 MiB of photos" },
  { id: "public_burst", title: "Serve 2,000 public downloads" },
];

function SectionHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h2>
      {children && (
        <div className="mt-3 leading-relaxed text-fd-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

function Tile({ value, children }: { value: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-fd-border bg-fd-card p-5">
      <p className="font-display text-3xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function Notes({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-6 flex max-w-3xl list-disc flex-col gap-3 pl-5 leading-relaxed text-fd-muted-foreground marker:text-fd-muted-foreground/60">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

const panelGrid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
// two panels side by side, each as wide as one in a row of three
const pairGrid = "grid gap-3 sm:grid-cols-2 lg:w-2/3";

export default function BenchmarksPage() {
  const { machine, runs, vazeBuild } = benchmarkRun;
  const speedups = allScenarios.map(speedup);
  const faster = speedups.filter((value) => value > 1).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-4 pt-16 pb-24 sm:gap-24 sm:px-6 sm:pt-24">
      <header className="flex flex-col gap-10">
        <div className="max-w-3xl">
          <p className="font-display text-sm font-semibold text-gold">
            Benchmarks
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">
            {appName} and Seafile, measured on the same machine
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-fd-muted-foreground">
            We ran sixteen everyday file operations, from uploading a 1 GiB file
            to renaming a document, against {appName} and against Seafile, a
            long-established self-hosted file server. {appName} finished first
            in{" "}
            {faster === allScenarios.length
              ? `all ${allScenarios.length}`
              : `${faster} of ${allScenarios.length}`}
            .
          </p>
          <p className="mt-3 text-sm text-fd-muted-foreground">
            Measured {benchmarkRun.date} on an {machine.cpu} with{" "}
            {machine.memory}. Median of {runs} runs per server.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Tile value={`${faster} of ${allScenarios.length}`}>
            operations where {appName} was faster
          </Tile>
          <Tile
            value={`${formatTimes(Math.min(...speedups))} to ${formatTimes(Math.max(...speedups))}`}
          >
            how much faster, depending on the operation
          </Tile>
          <Tile value={`${formatValue(memoryMB.fresh.vaze)} MB`}>
            memory after a fresh start, against{" "}
            {formatValue(memoryMB.fresh.seafile)} MB for Seafile with its
            database and cache
          </Tile>
        </div>
      </header>

      <section className="flex flex-col gap-6">
        <SectionHeading title={`${appName}'s speed next to Seafile's`}>
          <p>
            Each row is one operation. The vertical line is Seafile, and the dot
            shows how many times faster {appName} was. The scale is logarithmic.
            Hover over a row, or focus it, for the measured values.
          </p>
        </SectionHeading>
        <div className="rounded-xl border border-fd-border bg-fd-card p-3 sm:p-5">
          <div className="px-2">
            <Legend comparison />
          </div>
          <div className="mt-3">
            <SpeedupChart groups={scenarioGroups} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title="The measured numbers">
          <p>
            Medians of {runs} runs. For speeds a longer bar is better, for times
            a shorter one.
          </p>
        </SectionHeading>
        <Legend />
        <div className="flex flex-col gap-10">
          {scenarioGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <div
                className={`mt-3 ${group.scenarios.length % 3 === 0 ? panelGrid : pairGrid}`}
              >
                {group.scenarios.map((entry) => (
                  <ComparisonPanel
                    key={entry.id}
                    title={entry.name}
                    subtitle={`${entry.unit}, ${directionOf(entry)}. ${entry.detail}.`}
                    values={{
                      vaze: entry.results.vaze.median,
                      seafile: entry.results.seafile.median,
                    }}
                  />
                ))}
                {group.scenarios.some(({ id }) => id === "public_burst") && (
                  <ComparisonPanel
                    title="How long the slowest visitors waited"
                    subtitle="ms, lower is better. The slowest 5% of the 2,000 downloads."
                    values={publicSlowestMs}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title="What each server needs to run">
          <p>
            CPU time is what a server spent on the whole operation, with all
            cores added up. Seafile spent less moving a single large file, and{" "}
            {appName} spent less on everything involving many files or requests.
          </p>
        </SectionHeading>
        <Legend />
        <div className="flex flex-col gap-10">
          <div>
            <h3 className="text-sm font-semibold">CPU time</h3>
            <div className={`mt-3 ${panelGrid}`}>
              {cpuPanels.map(({ id, title }) => {
                const entry = scenario(id);
                return (
                  <ComparisonPanel
                    key={id}
                    title={title}
                    subtitle="CPU seconds, lower is better."
                    values={{
                      vaze: entry.results.vaze.cpuSeconds,
                      seafile: entry.results.seafile.cpuSeconds,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Memory</h3>
            <div className={`mt-3 ${pairGrid}`}>
              <ComparisonPanel
                title="After a fresh start"
                subtitle="MB, lower is better. Seafile's includes the MariaDB and Redis it needs to run."
                values={memoryMB.fresh}
              />
              <ComparisonPanel
                title="Highest during the runs"
                subtitle="MB, lower is better. Seafile's grew from one run to the next."
                values={memoryMB.peak}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading title="How it was measured" />
        <Notes
          items={[
            <>
              {appName} (
              <a
                href={vazeBuild.url}
                className="font-medium text-fd-foreground underline decoration-gold decoration-2 underline-offset-4"
              >
                {vazeBuild.label}
              </a>
              ) and Seafile {benchmarkRun.seafileVersion} Community Edition ran
              side by side in Docker on one machine: an {machine.cpu} (
              {machine.cores}) with {machine.memory}, {machine.storage}, on{" "}
              {machine.system}. Seafile ran on its default settings, with
              MariaDB 10.11, Redis and its Go file server.
            </>,
            <>
              A Node.js client called each server&apos;s own API, the same calls
              its web app makes, and reached the containers directly with no
              proxy in between. Against a server that does nothing, that client
              moves about 1,700 MB/s up and 2,800 MB/s down, so it never set the
              pace.
            </>,
            <>
              Each operation ran {runs} times per server, with the servers
              taking turns and the files deleted between runs. The charts show
              the median, and the table below shows the range.
            </>,
            <>
              File contents are random, so nothing compresses or deduplicates,
              and downloads were spot-checked against the SHA-256 of what was
              uploaded. Downloads were timed with the files already in the
              operating system&apos;s cache, as popular files on a busy server
              would be.
            </>,
            <>
              Uploads follow each web app: {appName}&apos;s dashboard sends 3
              files at a time and Seafile&apos;s sends 1. Sending Seafile more
              at once made it slower in this setup, with pauses of several
              seconds.
            </>,
            <>
              Rate limits were lifted on both servers, so the numbers show speed
              rather than limits: Seafile&apos;s API throttle and its 100 MB cap
              on folder zips, and {appName}&apos;s limit of 300 API requests a
              minute per client.
            </>,
          ]}
        />
      </section>

      <section>
        <SectionHeading title="What these numbers leave out" />
        <Notes
          items={[
            <>
              Seafile records every upload, rename, move and delete as a commit
              in the library&apos;s history, so it can bring back earlier
              versions of files and folders. {appName} keeps deleted items in
              Recently deleted, 30 days by default, but does not keep old
              versions.
            </>,
            <>
              Seafile stores files as deduplicated blocks, can encrypt a library
              with a password, and syncs folders with its desktop client over
              its own protocol. None of that was measured, and {appName} has no
              sync client.
            </>,
            <>
              Seafile compresses the zips it builds, which takes time on files
              that don&apos;t shrink. {appName} puts files in its zips as they
              are.
            </>,
            <>
              Everything ran on one machine over a local Docker network: no TLS,
              no internet or Wi-Fi in between, and no spinning disks.
            </>,
          ]}
        />
      </section>

      <section>
        <details className="group rounded-xl border border-fd-border bg-fd-card">
          <summary className="cursor-pointer rounded-xl px-5 py-4 font-medium focus-visible:outline-2 focus-visible:outline-gold">
            Every number, with the range across runs
          </summary>
          <div className="overflow-x-auto border-t border-fd-border">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-fd-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Operation</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    {appName}
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Seafile
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    {appName} vs Seafile
                  </th>
                </tr>
              </thead>
              {scenarioGroups.map((group) => (
                <tbody key={group.title}>
                  <tr>
                    <th
                      colSpan={4}
                      scope="colgroup"
                      className="border-t border-fd-border px-5 pt-4 pb-2 text-left text-xs font-semibold tracking-wider text-fd-muted-foreground uppercase"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.scenarios.map((entry) => (
                    <tr key={entry.id} className="border-t border-fd-border/60">
                      <th
                        scope="row"
                        className="min-w-56 px-5 py-2.5 text-left font-normal"
                      >
                        {entry.name}{" "}
                        <span className="text-fd-muted-foreground">
                          {entry.unit}
                        </span>
                      </th>
                      {(["vaze", "seafile"] as const).map((server) => {
                        const { median, min, max } = entry.results[server];
                        return (
                          <td
                            key={server}
                            className="px-5 py-2.5 text-right whitespace-nowrap"
                          >
                            {formatValue(median)}{" "}
                            <span className="text-xs text-fd-muted-foreground">
                              ({formatValue(min)} to {formatValue(max)})
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-5 py-2.5 text-right font-medium whitespace-nowrap">
                        {formatTimes(speedup(entry))} faster
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </details>
      </section>

      <p className="text-fd-muted-foreground">
        Want to see how it runs on your own hardware?{" "}
        <Link
          href={`${docsRoute}/getting-started/installation`}
          className="font-medium text-fd-foreground underline decoration-gold decoration-2 underline-offset-4"
        >
          Install {appName}
        </Link>{" "}
        in a few minutes.
      </p>
    </main>
  );
}
