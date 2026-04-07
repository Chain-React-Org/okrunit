"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---- Types ----------------------------------------------------------------

export interface VolumeDataPoint {
  date: string;
  count: number;
}

interface VolumeChartProps {
  data: VolumeDataPoint[];
  days?: number;
}

// ---- Component ------------------------------------------------------------

export function VolumeChart({ data, days = 30 }: VolumeChartProps) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Request Volume</CardTitle>
        <CardDescription>
          Daily approval requests over the last {days} days
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {data.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No volume data available
          </div>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground text-xs"
                  tickFormatter={(value: string) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground text-xs"
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const value = payload[0].value as number;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          {value} request{value !== 1 ? "s" : ""}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
