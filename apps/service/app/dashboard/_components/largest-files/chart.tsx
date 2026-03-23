"use client";

import { formatBytes } from "@/utils";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: {
    name: string;
    size: number;
  }[];
}

const barColors = [
  "oklch(0.7 0.15 220)",
  "oklch(0.7 0.15 200)",
  "oklch(0.7 0.15 180)",
  "oklch(0.7 0.15 160)",
  "oklch(0.65 0.12 160)",
];

export default function Chart({ data }: Props) {
  return (
    <div className="h-50">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <XAxis
            type="number"
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
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.15 0 0)",
              border: "1px solid oklch(0.25 0 0)",
              borderRadius: "8px",
              color: "oklch(0.95 0 0)",
            }}
            labelStyle={{ color: "oklch(0.95 0 0)" }}
            formatter={(value) => [formatBytes(Number(value)), "Size"]}
          />
          <Bar dataKey="size" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={barColors[index % barColors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function truncateName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  const ext = name.includes(".") ? "." + name.split(".").pop() : "";
  const baseName = name.slice(0, name.length - ext.length);
  const truncatedBase = baseName.slice(0, maxLength - ext.length - 3);
  return `${truncatedBase}...${ext}`;
}
