"use client";

import { formatBytes } from "@/utils";
import { Legend, PolarGrid, RadialBar, RadialBarChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface Props {
  data: {
    name: string;
    value: number;
    fill: string;
  }[];
}

export default function Chart({ data }: Props) {
  const chartConfig = {
    value: {
      label: "Storage Size",
    },
    ...Object.fromEntries(
      data.map((item) => [item.name, { label: item.name, color: item.fill }]),
    ),
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-62.5 w-full"
    >
      <RadialBarChart data={data} innerRadius={30} outerRadius={100}>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name, props) => (
                <div className="flex flex-row items-center justify-center gap-2">
                  <span className="text-xs">{formatBytes(Number(value))}</span>
                  <span className="text-muted-foreground font-medium">
                    {props.payload.name}
                  </span>
                </div>
              )}
            />
          }
        />
        <PolarGrid gridType="circle" />
        <RadialBar dataKey="value" />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: "12px" }}
          formatter={(value) => (
            <span style={{ color: "oklch(0.8 0 0)" }}>{value}</span>
          )}
        />
      </RadialBarChart>
    </ChartContainer>
  );
}
