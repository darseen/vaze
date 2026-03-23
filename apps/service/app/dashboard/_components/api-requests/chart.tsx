"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: {
    dayOfTheWeek: string;
    requests: number;
  }[];
}

export default function Chart({ data }: Props) {
  return (
    <div className="size-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <defs>
            <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="oklch(0.7 0.15 160)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="oklch(0.7 0.15 160)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dayOfTheWeek"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "oklch(0.6 0 0)", fontSize: 11 }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.15 0 0)",
              border: "1px solid oklch(0.25 0 0)",
              borderRadius: "8px",
              color: "oklch(0.95 0 0)",
            }}
            labelStyle={{ color: "oklch(0.7 0 0)" }}
            formatter={(value) => [value, "Requests"]}
          />
          <Area
            type="monotone"
            dataKey="requests"
            stroke="oklch(0.7 0.15 160)"
            fill="url(#requestsGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
