"use client";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

interface Props {
  data: {
    dayOfTheWeek: string;
    requests: number;
  }[];
}

const chartConfig = {
  requests: {
    label: "Requests",
    color: "oklch(0.8 0.15 85)",
  },
} satisfies ChartConfig;

export default function Chart({ data }: Props) {
  return (
    <ChartContainer config={chartConfig} className="size-full min-h-62.5">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
      >
        <defs>
          <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-requests)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--color-requests)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="dayOfTheWeek"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
          width={40}
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />

        <Area
          type="monotone"
          dataKey="requests"
          stroke="var(--color-requests)"
          fill="url(#requestsGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
