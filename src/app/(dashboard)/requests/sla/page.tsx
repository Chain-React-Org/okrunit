import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedOrgLayoutData } from "@/lib/cache/queries";
import { getSlaMetrics } from "@/lib/api/sla";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { VALID_DAYS } from "@/components/analytics/analytics-periods";
import { SlaComplianceDashboard } from "@/components/analytics/sla-compliance-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SlaConfig } from "@/lib/types/database";
import type { SlaMetrics } from "@/lib/api/sla";
import type { AtRiskRequest } from "@/components/analytics/sla-compliance-dashboard";

export const metadata = {
  title: "SLA Compliance - OKrunit",
  description: "Track SLA breach rates and compliance metrics.",
};

// Demo data to preview the page layout with realistic numbers
const DEMO_METRICS: SlaMetrics = {
  total: 142,
  breached: 8,
  breach_rate: 5.63,
  avg_response_time_minutes: 22,
  per_priority: {
    critical: {
      total: 18,
      breached: 3,
      breach_rate: 16.67,
      avg_response_time_minutes: 11,
    },
    high: {
      total: 45,
      breached: 4,
      breach_rate: 8.89,
      avg_response_time_minutes: 38,
    },
    medium: {
      total: 52,
      breached: 1,
      breach_rate: 1.92,
      avg_response_time_minutes: 47,
    },
    low: {
      total: 27,
      breached: 0,
      breach_rate: 0,
      avg_response_time_minutes: 95,
    },
  },
  daily_trend: Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const tracked = Math.floor(Math.random() * 8) + 2;
    return {
      date: d.toISOString().slice(0, 10),
      tracked,
      breached: Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0,
    };
  }),
};

export default async function SlaCompliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, org } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/requests");
  }

  const params = await searchParams;
  const showDemo = params.demo === "true";

  // Plan + date range
  const { currentPlan } = await getCachedOrgLayoutData(membership.org_id);
  const historyDays = PLAN_LIMITS[currentPlan].historyDays;
  const rawDays = Number(params.days) || 30;
  let days = VALID_DAYS.has(rawDays) ? rawDays : 30;
  if (historyDays !== -1 && days > historyDays) days = historyDays;

  let metrics: SlaMetrics;

  if (showDemo) {
    metrics = DEMO_METRICS;
  } else {
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    metrics = await getSlaMetrics(membership.org_id, {
      from: periodStart.toISOString(),
      to: now.toISOString(),
    });
  }

  // Fetch at-risk pending requests (>75% of SLA time elapsed, not yet breached)
  let atRiskRequests: AtRiskRequest[] = [];
  if (!showDemo) {
    const admin = createAdminClient();
    const { data: pendingWithSla } = await admin
      .from("approval_requests")
      .select("id, title, priority, sla_deadline, created_at")
      .eq("org_id", membership.org_id)
      .eq("status", "pending")
      .eq("sla_breached", false)
      .not("sla_deadline", "is", null)
      .order("sla_deadline", { ascending: true })
      .limit(20);

    const now = Date.now();
    atRiskRequests = (pendingWithSla ?? []).filter((r) => {
      const created = new Date(r.created_at).getTime();
      const deadline = new Date(r.sla_deadline!).getTime();
      const total = deadline - created;
      const elapsed = now - created;
      return total > 0 && elapsed / total >= 0.75;
    }) as AtRiskRequest[];
  }

  return (
    <SlaComplianceDashboard
      metrics={metrics}
      slaConfig={org.sla_config as SlaConfig}
      showDemo={showDemo}
      days={days}
      plan={currentPlan}
      atRiskRequests={atRiskRequests}
    />
  );
}
