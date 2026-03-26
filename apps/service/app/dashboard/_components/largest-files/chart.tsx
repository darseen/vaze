"use client";

import { formatBytes } from "@/utils";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface Props {
  data: {
    name: string;
    size: number;
  }[];
}

const barColors = [
  "oklch(0.85 0.16 90)",
  "oklch(0.80 0.16 85)",
  "oklch(0.75 0.15 80)",
  "oklch(0.70 0.14 75)",
  "oklch(0.65 0.12 70)",
];

const chartConfig = {
  size: {
    label: "Size",
  },
} satisfies ChartConfig;

function truncateName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  const ext = name.includes(".") ? "." + name.split(".").pop() : "";
  const baseName = name.slice(0, name.length - ext.length);
  const truncatedBase = baseName.slice(0, maxLength - ext.length - 3);
  return `${truncatedBase}...${ext}`;
}

export default function Chart({ data }: Props) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: barColors[index % barColors.length],
  }));

  return (
    <div className="size-full min-h-62.5">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart
          accessibilityLayer
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <XAxis
            type="number"
            dataKey="size"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
            tickFormatter={(value) => formatBytes(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
            tickFormatter={(value) => truncateName(value, 15)}
            width={100}
          />
          <ChartTooltip
            cursor={{ fill: "oklch(0.5 0 0 / 0.1)", radius: 4 }}
            content={
              <ChartTooltipContent
                formatter={(value) => formatBytes(Number(value))}
              />
            }
          />
          <Bar dataKey="size" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
