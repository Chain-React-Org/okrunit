export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import type { VolumeDataPoint } from "@/components/analytics/volume-chart";
import type { ApprovalRateDataPoint } from "@/components/analytics/approval-rate-chart";
import type { ResponseTimeDataPoint } from "@/components/analytics/response-time-chart";

export const metadata = {
  title: "Analytics - OKRunit",
  description: "Dashboard analytics and approval statistics.",
};

export default async function AnalyticsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const orgId = ctx.membership.org_id;
  const admin = createAdminClient();

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();
  const sixtyDaysAgoISO = sixtyDaysAgo.toISOString();

  // Fetch all counts and chart data in a single parallel batch
  const [
    { count: total },
    { count: pending },
    { count: approved },
    { count: rejected },
    { count: prevTotal },
    { count: prevPending },
    { count: prevApproved },
    { count: prevRejected },
    { count: currentPeriodTotal },
    { data: recentRequests },
    { data: decidedRequests },
    { data: timedRequests },
  ] = await Promise.all([
    // Current counts
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "approved"),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "rejected"),
    // Previous period counts
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", sixtyDaysAgoISO).lt("created_at", thirtyDaysAgoISO),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending").gte("created_at", sixtyDaysAgoISO).lt("created_at", thirtyDaysAgoISO),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "approved").gte("created_at", sixtyDaysAgoISO).lt("created_at", thirtyDaysAgoISO),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "rejected").gte("created_at", sixtyDaysAgoISO).lt("created_at", thirtyDaysAgoISO),
    // Current period total
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", thirtyDaysAgoISO),
    // Chart data
    admin.from("approval_requests").select("created_at").eq("org_id", orgId).gte("created_at", thirtyDaysAgoISO).order("created_at", { ascending: true }),
    admin.from("approval_requests").select("status, decided_at").eq("org_id", orgId).in("status", ["approved", "rejected"]).gte("decided_at", thirtyDaysAgoISO).order("decided_at", { ascending: true }),
    admin.from("approval_requests").select("created_at, decided_at").eq("org_id", orgId).in("status", ["approved", "rejected"]).not("decided_at", "is", null).gte("decided_at", thirtyDaysAgoISO).order("decided_at", { ascending: true }),
  ]);

  const totalNum = total ?? 0;
  const pendingNum = pending ?? 0;
  const approvedNum = approved ?? 0;
  const rejectedNum = rejected ?? 0;
  const decidedNum = approvedNum + rejectedNum;
  const approvalRate = decidedNum > 0 ? Math.round((approvedNum / decidedNum) * 100) : 0;

  function calcTrend(current: number, previous: number | null): number | null {
    const prev = previous ?? 0;
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return 100;
    return Math.round(((current - prev) / prev) * 100);
  }

  const prevDecided = (prevApproved ?? 0) + (prevRejected ?? 0);
  const prevApprovalRate = prevDecided > 0 ? Math.round(((prevApproved ?? 0) / prevDecided) * 100) : 0;

  const trends = {
    totalTrend: calcTrend(currentPeriodTotal ?? 0, prevTotal),
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
