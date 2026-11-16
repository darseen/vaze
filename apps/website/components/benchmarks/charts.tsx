import type { Scenario, Server } from "@/lib/benchmarks";
import { speedup } from "@/lib/benchmarks";

const SERVER_NAMES: Record<Server, string> = {
  vaze: "Vaze",
  seafile: "Seafile",
};

const MARK_COLORS: Record<Server, string> = {
  vaze: "bg-chart-vaze",
  seafile: "bg-chart-other",
};

// Vaze leads every chart, so it reads first
const ORDER: Server[] = ["vaze", "seafile"];

export function formatValue(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString("en-US");
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatTimes(value: number): string {
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}×`;
}

export function directionOf(scenario: Scenario): string {
  return scenario.better === "higher" ? "higher is better" : "lower is better";
}

export function Legend({ comparison = false }: { comparison?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fd-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span
          className={`${MARK_COLORS.vaze} ${comparison ? "size-3 rounded-full" : "h-3 w-3.5 rounded-[3px]"}`}
          aria-hidden
        />
        Vaze
      </span>
      <span className="inline-flex items-center gap-2">
        {comparison ? (
          <span className="h-3.5 w-0.5 bg-fd-muted-foreground/50" aria-hidden />
        ) : (
          <span
            className={`h-3 w-3.5 rounded-[3px] ${MARK_COLORS.seafile}`}
            aria-hidden
          />
        )}
        {comparison ? "Seafile, always at 1×" : "Seafile"}
      </span>
    </div>
  );
}

const TICKS = [1, 2, 5, 10, 20, 50, 100];

/** One row per scenario: how many times faster Vaze was, on a log scale from parity. */
export function SpeedupChart({
  groups,
}: {
  groups: { title: string; scenarios: Scenario[] }[];
}) {
  const largest = Math.max(
    ...groups.flatMap((group) => group.scenarios.map(speedup)),
  );
  const top = TICKS.find((tick) => tick >= largest * 1.05) ?? TICKS.at(-1)!;
  const ticks = TICKS.filter((tick) => tick <= top);
  const x = (value: number) => (Math.log(value) / Math.log(top)) * 100;

  const row =
    "grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_3.5rem]";

  const gridlines = ticks.map((tick) => (
    <span
      key={tick}
      className={`absolute inset-y-0 ${tick === 1 ? "w-0.5 -translate-x-1/2 bg-fd-muted-foreground/50" : "w-px bg-fd-border"}`}
      style={{ left: `${x(tick)}%` }}
    />
  ));

  return (
    <div className="flex flex-col">
      <div className={`${row} px-2`} aria-hidden>
        <span className="hidden sm:block" />
        <div className="relative mx-2 h-6">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute bottom-1 -translate-x-1/2 text-xs text-fd-muted-foreground tabular-nums"
              style={{ left: `${x(tick)}%` }}
            >
              {tick}×
            </span>
          ))}
        </div>
        <span />
      </div>

      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="px-2 pt-5 pb-1.5 text-xs font-semibold tracking-wider text-fd-muted-foreground uppercase">
            {group.title}
          </h3>
          <ul className="flex flex-col">
            {group.scenarios.map((scenario) => {
              const times = speedup(scenario);
              const { vaze, seafile } = scenario.results;

              return (
                <li
                  key={scenario.id}
                  tabIndex={0}
                  aria-label={`${scenario.name}: Vaze ${formatTimes(times)} as fast as Seafile, ${formatValue(vaze.median)} against ${formatValue(seafile.median)} ${scenario.unit}`}
                  className={`group relative ${row} rounded-lg px-2 py-1.5 outline-none hover:bg-fd-accent/50 focus:bg-fd-accent/50 focus-visible:ring-2 focus-visible:ring-gold`}
                >
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <p className="text-sm leading-snug">{scenario.name}</p>
                  </div>

                  <div className="relative mx-2 h-7" aria-hidden>
                    {gridlines}
                    <span
                      className={`absolute top-1/2 h-0.5 -translate-y-1/2 ${MARK_COLORS.vaze}`}
                      style={{ left: 0, width: `${x(times)}%` }}
                    />
                    <span
                      className={`absolute top-1/2 size-3 -translate-1/2 rounded-full ring-2 ring-fd-card ${MARK_COLORS.vaze}`}
                      style={{ left: `${x(times)}%` }}
                    />
                  </div>

                  <span className="text-right text-sm font-semibold tabular-nums">
                    {formatTimes(times)}
                  </span>

                  {/* the measured values behind the ratio, on hover or focus */}
                  <div
                    className="pointer-events-none absolute right-2 bottom-full z-10 mb-1 hidden min-w-48 flex-col gap-1 rounded-lg border border-fd-border bg-fd-popover px-3 py-2 text-sm shadow-lg group-hover:flex group-focus:flex"
                    aria-hidden
                  >
                    {ORDER.map((server) => (
                      <span key={server} className="flex items-center gap-2">
                        <span className={`h-0.5 w-3 ${MARK_COLORS[server]}`} />
                        <span className="font-semibold tabular-nums">
                          {formatValue(scenario.results[server].median)}{" "}
                          {scenario.unit}
                        </span>
                        <span className="text-fd-muted-foreground">
                          {SERVER_NAMES[server]}
                        </span>
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Two bars, Vaze and Seafile, on a shared zero baseline. */
export function ComparisonPanel({
  title,
  subtitle,
  values,
}: {
  title: string;
  subtitle: string;
  values: Record<Server, number>;
}) {
  const max = Math.max(values.vaze, values.seafile);

  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-xl border border-fd-border bg-fd-card p-4">
      <figcaption>
        <p className="font-medium leading-snug">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-fd-muted-foreground">
          {subtitle}
        </p>
      </figcaption>
      <div className="mt-auto grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
        {ORDER.map((server) => (
          <div key={server} className="contents">
            <span className="text-fd-muted-foreground">
              {SERVER_NAMES[server]}
            </span>
            <span className="h-3.5" aria-hidden>
              <span
                className={`block h-full rounded-r-[4px] ${MARK_COLORS[server]}`}
                style={{
                  width: `${Math.max(0.6, (values[server] / max) * 100)}%`,
                }}
              />
            </span>
            <span className="text-right font-medium tabular-nums">
              {formatValue(values[server])}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}
