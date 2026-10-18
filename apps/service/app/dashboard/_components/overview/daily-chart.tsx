"use client";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts";

/** One day, with its text formatted on the server. */
export interface DailyPoint {
  date: string;
  /** Short x-axis label, e.g. "Oct 18" or "Sat". */
  tick: string;
  /** Tooltip heading, e.g. "Sat, Oct 18". */
  label: string;
  value: number;
  details: string[];
}

const TICK = { fill: "oklch(0.6 0 0)", fontSize: 11 };

function Tooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DailyPoint }[];
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div className="border-border/50 bg-background grid min-w-32 gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{point.label}</p>
      {point.details.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

export default function DailyChart({
  data,
  variant,
  name,
}: {
  data: DailyPoint[];
  variant: "area" | "bar";
  name: string;
}) {
  const config = {
    value: { label: name, color: "var(--color-usage)" },
  } satisfies ChartConfig;

  const axes = (
    <>
      <XAxis
        dataKey="tick"
        tickLine={false}
        axisLine={false}
        tick={TICK}
        tickMargin={8}
        interval="preserveStartEnd"
        minTickGap={16}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        tick={TICK}
        width={40}
        allowDecimals={false}
      />
    </>
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      {variant === "area" ? (
        <AreaChart
          accessibilityLayer
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="dailyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-value)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--color-value)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          {axes}
          <ChartTooltip cursor={false} content={<Tooltip />} />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--color-value)"
            fill="url(#dailyGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      ) : (
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          {axes}
          <ChartTooltip
            cursor={{ fill: "oklch(0.5 0 0 / 0.1)", radius: 4 }}
            content={<Tooltip />}
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      )}
    </ChartContainer>
  );
}
