"use client";

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

type Point = { date: string; clicks: number; impressions: number };

export default function SeoSparkline({ series }: { series: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="seoImpr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1B4B43" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#1B4B43" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip
          formatter={(value, name) => [Number(value).toLocaleString("en-GB"), name === "impressions" ? "Impressions" : "Clicks"]}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E5E7EB" }}
        />
        <Area type="monotone" dataKey="impressions" stroke="#1B4B43" strokeWidth={1.5} fill="url(#seoImpr)" dot={false} />
        <Area type="monotone" dataKey="clicks" stroke="#D89A35" strokeWidth={1.5} fill="none" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
