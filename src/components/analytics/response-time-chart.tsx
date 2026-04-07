"use client";

import {
  LineChart,
  Line,
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

export interface ResponseTimeDataPoint {
  date: string;
  avg_response_time_hours: number;
}

interface ResponseTimeChartProps {
  data: ResponseTimeDataPoint[];
  days?: number;
}

// ---- Component ------------------------------------------------------------

export function ResponseTimeChart({ data, days = 30 }: ResponseTimeChartProps) {
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Average Response Time</CardTitle>
        <CardDescription>
          Time to decision per day over the last {days} days (hours)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {data.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            No response time data available
          </div>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
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
                  tickFormatter={(value: number) => `${value}h`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const value = payload[0].value as number;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-sm text-muted-foreground">
                          Avg: {value.toFixed(1)}h
                        </p>
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_response_time_hours"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
