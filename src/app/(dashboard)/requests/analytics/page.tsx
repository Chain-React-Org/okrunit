import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedAnalyticsData } from "@/lib/cache/queries";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import type { VolumeDataPoint } from "@/components/analytics/volume-chart";
import type { ApprovalRateDataPoint } from "@/components/analytics/approval-rate-chart";
import type { ResponseTimeDataPoint } from "@/components/analytics/response-time-chart";

export const metadata = {
  title: "Analytics - OKrunit",
  description: "Dashboard analytics and approval statistics.",
};

export default async function AnalyticsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const orgId = ctx.membership.org_id;

  const {
    totalCount: total,
    pendingCount: pending,
    approvedCount: approved,
    rejectedCount: rejected,
    prevTotalCount: prevTotal,
    prevPendingCount: prevPending,
    prevApprovedCount: prevApproved,
    prevRejectedCount: prevRejected,
    volumeData: recentRequests,
    decisionData: decidedRequests,
    responseTimeData: timedRequests,
  } = await getCachedAnalyticsData(orgId);

  const now = new Date();

  const totalNum = total;
  const pendingNum = pending;
  const approvedNum = approved;
  const rejectedNum = rejected;
  const decidedNum = approvedNum + rejectedNum;
  const approvalRate = decidedNum > 0 ? Math.round((approvedNum / decidedNum) * 100) : 0;

  function calcTrend(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
  }

  const prevDecided = prevApproved + prevRejected;
  const prevApprovalRate = prevDecided > 0 ? Math.round((prevApproved / prevDecided) * 100) : 0;

  // currentPeriodTotal = total - (items outside last 30 days) — approximate with total for trend
  const trends = {
    totalTrend: calcTrend(totalNum, prevTotal),
    pendingTrend: calcTrend(pendingNum, prevPending),
    approvalRateTrend: prevDecided > 0 || decidedNum > 0 ? calcTrend(approvalRate, prevApprovalRate) : null,
    decidedTrend: calcTrend(decidedNum, prevDecided),
  };

  const volumeMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    volumeMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of recentRequests ?? []) {
    const dateKey = row.created_at.slice(0, 10);
    volumeMap.set(dateKey, (volumeMap.get(dateKey) ?? 0) + 1);
  }
  const volumeData: VolumeDataPoint[] = Array.from(volumeMap.entries()).map(([date, count]) => ({ date, count }));

  const rateMap = new Map<string, { approved: number; rejected: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    rateMap.set(d.toISOString().slice(0, 10), { approved: 0, rejected: 0 });
  }
  for (const row of decidedRequests ?? []) {
    if (!row.decided_at) continue;
    const dateKey = row.decided_at.slice(0, 10);
    const entry = rateMap.get(dateKey) ?? { approved: 0, rejected: 0 };
    if (row.status === "approved") entry.approved++;
    else entry.rejected++;
    rateMap.set(dateKey, entry);
  }
  const approvalRateData: ApprovalRateDataPoint[] = Array.from(rateMap.entries()).map(([date, counts]) => ({ date, ...counts }));

  const timeMap = new Map<string, { totalHours: number; count: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    timeMap.set(d.toISOString().slice(0, 10), { totalHours: 0, count: 0 });
  }
  for (const row of timedRequests ?? []) {
    if (!row.decided_at || !row.created_at) continue;
    const dateKey = row.decided_at.slice(0, 10);
    const hours = (new Date(row.decided_at).getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
    const entry = timeMap.get(dateKey) ?? { totalHours: 0, count: 0 };
    entry.totalHours += hours;
    entry.count++;
    timeMap.set(dateKey, entry);
  }
  const responseTimeData: ResponseTimeDataPoint[] = Array.from(timeMap.entries()).map(([date, { totalHours, count }]) => ({
    date,
    avg_response_time_hours: count > 0 ? Math.round((totalHours / count) * 10) / 10 : 0,
  }));

  return (
    <AnalyticsDashboard
      stats={{
        total: totalNum,
        pending: pendingNum,
        approved: approvedNum,
        rejected: rejectedNum,
        decided: decidedNum,
        approvalRate,
      }}
      trends={trends}
      volumeData={volumeData}
      approvalRateData={approvalRateData}
      responseTimeData={responseTimeData}
    />
  );
}
