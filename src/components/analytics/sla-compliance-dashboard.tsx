"use client";

import { memo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  TrendingUp,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SlaMetrics } from "@/lib/api/sla";
import type { SlaConfig, BillingPlan } from "@/lib/types/database";
import dynamic from "next/dynamic";

const DateRangeSelector = dynamic(() => import("./date-range-selector").then((m) => m.DateRangeSelector));

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  critical: { color: "text-red-600", bg: "bg-red-500/10" },
  high: { color: "text-orange-600", bg: "bg-orange-500/10" },
  medium: { color: "text-blue-600", bg: "bg-blue-500/10" },
  low: { color: "text-zinc-500", bg: "bg-zinc-500/10" },
};

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function complianceColor(rate: number): string {
  if (rate >= 95) return "text-emerald-600";
  if (rate >= 80) return "text-amber-600";
  return "text-red-600";
}

function complianceBg(rate: number): string {
  if (rate >= 95) return "bg-emerald-500/10";
  if (rate >= 80) return "bg-amber-500/10";
  return "bg-red-500/10";
}

interface SlaComplianceDashboardProps {
  metrics: SlaMetrics;
  slaConfig: SlaConfig;
  showDemo?: boolean;
  days: number;
  plan: BillingPlan;
  atRiskRequests?: AtRiskRequest[];
}

export interface AtRiskRequest {
  id: string;
  title: string;
  priority: string;
  sla_deadline: string;
  created_at: string;
}

export const SlaComplianceDashboard = memo(function SlaComplianceDashboard({ metrics, slaConfig, showDemo, days, plan, atRiskRequests = [] }: SlaComplianceDashboardProps) {
  const complianceRate = metrics.total > 0 ? Math.round((1 - metrics.breach_rate / 100) * 10000) / 100 : 100;

  return (
    <div className="space-y-6">
      {/* Demo banner */}
      {showDemo && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>Showing demo data. <Link href="/requests/sla" className="font-medium underline">View real data</Link></span>
        </div>
      )}

      {/* Header + date range */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary mb-0.5">Insights</p>
            <h1 className="text-xl font-semibold tracking-tight">SLA Compliance</h1>
          </div>
          <DateRangeSelector currentDays={days} plan={plan} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Track how quickly your team responds to approval requests against SLA targets.
          Each request gets a deadline based on its priority. Breaches occur when a request
          isn&apos;t decided before its deadline expires. Configure your SLA targets per priority
          level in settings, and use this page to monitor compliance and catch at-risk requests
          before they breach.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Compliance Rate */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", complianceBg(complianceRate))}>
            <ShieldCheck className={cn("size-5", complianceColor(complianceRate))} />
          </div>
          <div>
            <p className={cn("text-2xl font-bold tracking-tight leading-none", complianceColor(complianceRate))}>
              {complianceRate}%
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">Compliance</p>
              </TooltipTrigger>
              <TooltipContent>Percentage of requests decided before their SLA deadline</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Total with SLA */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
            <TrendingUp className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight leading-none">{metrics.total}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">Tracked</p>
              </TooltipTrigger>
              <TooltipContent>Requests with an SLA deadline based on their priority</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Breached */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", metrics.breached > 0 ? "bg-red-500/10" : "bg-emerald-500/10")}>
            {metrics.breached > 0 ? (
              <ShieldAlert className="size-5 text-red-500" />
            ) : (
              <ShieldCheck className="size-5 text-emerald-500" />
            )}
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight leading-none">{metrics.breached}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">Breached</p>
              </TooltipTrigger>
              <TooltipContent>Requests still pending when their SLA deadline passed</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
            <Clock className="size-5 text-violet-500" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight leading-none">
              {metrics.avg_response_time_minutes > 0
                ? formatMinutes(metrics.avg_response_time_minutes)
                : "-"}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground mt-1 cursor-help">Avg Response</p>
              </TooltipTrigger>
              <TooltipContent>Average time from request creation to decision</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Breach trend chart */}
      {metrics.daily_trend.length > 0 && (
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm">Breach Trend</CardTitle>
            <p className="text-xs text-muted-foreground">
              Daily tracked requests vs breaches over the last {days} days
            </p>
          </CardHeader>
          <CardContent className="px-4">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.daily_trend}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground text-xs"
                    tickFormatter={(value: string) => {
                      const d = new Date(value);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground text-xs" allowDecimals={false} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                          <p className="text-sm font-medium mb-1">{label}</p>
                          {payload.map((entry) => (
                            <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
                              {entry.name === "tracked" ? "Tracked" : "Breached"}: {entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend formatter={(value: string) => (value === "tracked" ? "Tracked" : "Breached")} />
                  <Bar dataKey="tracked" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="breached" fill="var(--color-chart-5)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-priority breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Compliance by Priority</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.total === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <ShieldCheck className="size-6 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No SLA-tracked requests in the last 30 days</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Requests with SLA deadlines will appear here once they come in.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {PRIORITIES.map((priority) => {
                const data = metrics.per_priority[priority];
                const slaMinutes = slaConfig[priority];
                const priorityComplianceRate = data.total > 0
                  ? Math.round((1 - data.breach_rate / 100) * 10000) / 100
                  : 100;
                const style = PRIORITY_STYLES[priority];

                return (
                  <div key={priority} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs capitalize", style.color)}>
                          {priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          SLA: {slaMinutes ? formatMinutes(slaMinutes) : "Not set"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          {data.total} tracked
                        </span>
                        {data.breached > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="size-3" />
                            {data.breached} breached
                          </span>
                        )}
                        <span className={cn("font-semibold", data.total > 0 ? complianceColor(priorityComplianceRate) : "text-muted-foreground")}>
                          {data.total > 0 ? `${priorityComplianceRate}%` : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {data.total > 0 && (
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            priorityComplianceRate >= 95
                              ? "bg-emerald-500"
                              : priorityComplianceRate >= 80
                                ? "bg-amber-500"
                                : "bg-red-500",
                          )}
                          style={{ width: `${Math.min(100, priorityComplianceRate)}%` }}
                        />
                      </div>
                    )}

                    {/* Response time - only show when this priority has tracked requests */}
                    {data.total > 0 && data.avg_response_time_minutes > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="size-3" />
                        Avg response: {formatMinutes(data.avg_response_time_minutes)}
                        {slaMinutes && data.avg_response_time_minutes > slaMinutes && (
                          <span className="text-red-500 font-medium ml-1">
                            (exceeds SLA by {formatMinutes(data.avg_response_time_minutes - slaMinutes)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* At Risk - pending requests approaching SLA deadline */}
      {atRiskRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                At Risk
                <Badge variant="secondary" className="text-[10px]">
                  {atRiskRequests.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Pending requests that have used over 75% of their SLA time. Act on these before they breach.
            </p>
            <div className="space-y-2">
              {atRiskRequests.map((req) => {
                const deadline = new Date(req.sla_deadline);
                const created = new Date(req.created_at);
                const now = new Date();
                const totalMs = deadline.getTime() - created.getTime();
                const elapsedMs = now.getTime() - created.getTime();
                const pct = totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 100;
                const remainingMinutes = Math.max(0, (deadline.getTime() - now.getTime()) / 60_000);
                const isBreached = remainingMinutes <= 0;
                const style = PRIORITY_STYLES[req.priority] ?? PRIORITY_STYLES.medium;

                return (
                  <Link
                    key={req.id}
                    href={`/requests/${req.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-white px-3 py-2.5 transition-colors hover:border-border dark:bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={cn("text-[10px] capitalize", style.color)}>
                          {req.priority}
                        </Badge>
                        <span className={cn("text-[11px] font-medium", isBreached ? "text-red-500" : "text-amber-600")}>
                          {isBreached ? "Breached" : `${formatMinutes(remainingMinutes)} remaining`}
                        </span>
                      </div>
                    </div>
                    <div className="w-16 shrink-0">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isBreached ? "bg-red-500" : pct >= 90 ? "bg-red-400" : "bg-amber-400",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center mt-0.5">{pct}%</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SLA Configuration reference */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Current SLA Targets</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 bg-white dark:bg-card" asChild>
              <Link href="/org/settings">
                <Settings className="size-3" />
                Edit Targets
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PRIORITIES.map((priority) => {
              const minutes = slaConfig[priority];
              const style = PRIORITY_STYLES[priority];
              return (
                <div
                  key={priority}
                  className={cn("rounded-lg border border-border/50 px-3 py-2 text-center", style.bg)}
                >
                  <p className={cn("text-xs font-medium capitalize", style.color)}>{priority}</p>
                  <p className="text-lg font-bold mt-0.5">
                    {minutes ? formatMinutes(minutes) : "-"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {minutes ? "target" : "no SLA"}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
