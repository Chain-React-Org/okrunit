"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Clock, CheckCircle, Timer, BarChart3, Download, Info, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { VolumeDataPoint } from "./volume-chart";
import type { ApprovalRateDataPoint } from "./approval-rate-chart";
import type { ResponseTimeDataPoint } from "./response-time-chart";
import type { BillingPlan } from "@/lib/types/database";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import dynamic from "next/dynamic";

const DateRangeSelector = dynamic(() => import("./date-range-selector").then((m) => m.DateRangeSelector));

const VolumeChart = dynamic(() => import("./volume-chart").then((m) => m.VolumeChart));
const ApprovalRateChart = dynamic(() => import("./approval-rate-chart").then((m) => m.ApprovalRateChart));
const ResponseTimeChart = dynamic(() => import("./response-time-chart").then((m) => m.ResponseTimeChart));
const PatternSuggestions = dynamic(() => import("./pattern-suggestions").then((m) => m.PatternSuggestions));

// ---- Types ----------------------------------------------------------------

export interface AnalyticsDashboardProps {
  /** Stat card data, all primitives, safe to pass from server components */
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    decided: number;
    approvalRate: number;
  };
  /** Trend data compared to previous period */
  trends: {
    totalTrend: number | null;
    pendingTrend: number | null;
    approvalRateTrend: number | null;
    decidedTrend: number | null;
  };
  /** Chart data: arrays of serializable objects */
  volumeData: VolumeDataPoint[];
  approvalRateData: ApprovalRateDataPoint[];
  responseTimeData: ResponseTimeDataPoint[];
  /** Current period in days and billing plan for the date range selector */
  days: number;
  plan: BillingPlan;
}

// ---- Component ------------------------------------------------------------

export function AnalyticsDashboard({
  stats,
  trends,
  volumeData,
  approvalRateData,
  responseTimeData,
  days,
  plan,
}: AnalyticsDashboardProps) {
  const DISMISS_KEY = "okrunit:analytics-retention-dismissed";
  const [bannerDismissed, setBannerDismissed] = useState(true); // start hidden to avoid flash
  useEffect(() => {
    setBannerDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const showBanner = PLAN_LIMITS[plan].historyDays !== -1 && !bannerDismissed;

  function dismissBanner() {
    localStorage.setItem(DISMISS_KEY, "1");
    setBannerDismissed(true);
  }

  const makeTrend = (value: number | null, label: string) =>
    value !== null ? { value, label } : undefined;

  function exportCsv() {
    // Merge all chart data by date into a single CSV
    const dateMap = new Map<string, Record<string, string | number>>();

    for (const d of volumeData) {
      dateMap.set(d.date, { date: d.date, requests: d.count });
    }
    for (const d of approvalRateData) {
      const row = dateMap.get(d.date) ?? { date: d.date };
      row.approved = d.approved;
      row.rejected = d.rejected;
      dateMap.set(d.date, row);
    }
    for (const d of responseTimeData) {
      const row = dateMap.get(d.date) ?? { date: d.date };
      row.avg_response_hours = d.avg_response_time_hours;
      dateMap.set(d.date, row);
    }

    const headers = ["Date", "Requests", "Approved", "Rejected", "Avg Response Time (hrs)"];
    const rows = Array.from(dateMap.values())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((row) =>
        [
          row.date,
          row.requests ?? 0,
          row.approved ?? 0,
          row.rejected ?? 0,
          typeof row.avg_response_hours === "number"
            ? row.avg_response_hours.toFixed(2)
            : "0.00",
        ].join(","),
      );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okrunit-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Analytics exported");
  }

  return (
    <div className="space-y-4">
      {/* Data retention notice. Dismissible, only for plans with limited history */}
      {showBanner && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">
            Your <span className="font-medium">{PLAN_LIMITS[plan].name}</span> plan retains analytics data for{" "}
            <span className="font-medium">{PLAN_LIMITS[plan].historyDays} days</span>.
            To keep historical data beyond this window, export it as CSV before it ages out.{" "}
            <Link href="/org/billing" className="font-medium underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200">
              Upgrade your plan
            </Link>{" "}
            for longer retention.
          </p>
          <button
            onClick={dismissBanner}
            className="mt-0.5 shrink-0 rounded-md p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-800/40"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Header with date range + export */}
      <div className="flex items-center justify-end gap-2">
        <DateRangeSelector currentDays={days} plan={plan} />
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 bg-white dark:bg-card">
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon={BarChart3}
          subtitle={!trends.totalTrend ? "All time" : undefined}
          trend={makeTrend(trends.totalTrend, "vs prev. period")}
          iconColor="text-violet-500"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon={Clock}
          subtitle={!trends.pendingTrend ? "Awaiting decision" : undefined}
          trend={makeTrend(trends.pendingTrend, "vs prev. period")}
          iconColor="text-amber-500"
        />
        <StatCard
          title="Approval Rate"
          value={`${stats.approvalRate}%`}
          icon={CheckCircle}
          subtitle={
            !trends.approvalRateTrend
              ? `${stats.approved} approved, ${stats.rejected} rejected`
              : undefined
          }
          trend={makeTrend(trends.approvalRateTrend, "vs prev. period")}
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Decided"
          value={stats.decided}
          icon={Timer}
          subtitle={!trends.decidedTrend ? "Approved + rejected" : undefined}
          trend={makeTrend(trends.decidedTrend, "vs prev. period")}
          iconColor="text-blue-500"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <VolumeChart data={volumeData} days={days} />
        </div>
        <ApprovalRateChart data={approvalRateData} days={days} />
        <ResponseTimeChart data={responseTimeData} days={days} />
      </div>

      {/* Rule suggestions based on approval history */}
      <PatternSuggestions />
    </div>
  );
}
