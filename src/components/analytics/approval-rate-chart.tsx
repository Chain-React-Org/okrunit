"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---- Types ----------------------------------------------------------------

export interface ApprovalRateDataPoint {
  date: string;
  approved: number;
  rejected: number;
}

interface ApprovalRateChartProps {
  data: ApprovalRateDataPoint[];
  days?: number;
}

// ---- Component ------------------------------------------------------------

export function ApprovalRateChart({ data, days = 30 }: ApprovalRateChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval vs Rejection Rate</CardTitle>
        <CardDescription>
          Daily approved and rejected counts over the last {days} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No approval/rejection data available
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="approvedGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-chart-2)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-chart-2)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="rejectedGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-chart-5)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-chart-5)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
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
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                        <p className="mb-1 text-sm font-medium">{label}</p>
                        {payload.map((entry) => (
                          <p
                            key={entry.name}
                            className="text-sm"
                            style={{ color: entry.color }}
                          >
                            {entry.name === "approved"
                              ? "Approved"
                              : "Rejected"}
                            : {entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    value === "approved" ? "Approved" : "Rejected"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stroke="var(--color-chart-2)"
                  fillOpacity={1}
                  fill="url(#approvedGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  stroke="var(--color-chart-5)"
                  fillOpacity={1}
                  fill="url(#rejectedGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
