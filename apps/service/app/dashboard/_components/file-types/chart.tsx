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
          cursor={{ fill: "oklch(0.5 0 0 / 0.1)" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name, props) => (
                <div className="flex flex-row items-center justify-center gap-2">
                  <span className="text-xs font-medium">
                    {formatBytes(Number(value))}
                  </span>
                  <span className="text-muted-foreground">
                    {props.payload.name}
                  </span>
                </div>
              )}
            />
          }
        />
        <PolarGrid gridType="circle" stroke="oklch(0.5 0 0 / 0.15)" />

        <RadialBar dataKey="value" cornerRadius={4} />

        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: "12px" }}
          formatter={(value) => (
            <span className="text-foreground font-medium">{value}</span>
          )}
        />
      </RadialBarChart>
    </ChartContainer>
  );
}
