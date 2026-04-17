// ---------------------------------------------------------------------------
// OKrunit -- SLA Tracking
// ---------------------------------------------------------------------------
//
// Utilities for calculating SLA deadlines, checking breaches, and gathering
// SLA metrics for analytics.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { ApprovalPriority } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-priority SLA configuration. Values are minutes or null (no SLA). */
export interface SlaConfig {
  low: number | null;
  medium: number | null;
  high: number | null;
  critical: number | null;
}

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  low: null,
  medium: null,
  high: 60,
  critical: 15,
};

export interface SlaDailyTrendPoint {
  date: string;
  tracked: number;
  breached: number;
}

export interface SlaMetrics {
  total: number;
  breached: number;
  breach_rate: number;
  avg_response_time_minutes: number;
  per_priority: Record<
    ApprovalPriority,
    {
      total: number;
      breached: number;
      breach_rate: number;
      avg_response_time_minutes: number;
    }
  >;
  daily_trend: SlaDailyTrendPoint[];
}

// ---------------------------------------------------------------------------
// SLA Deadline Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the SLA deadline for an approval based on its priority and the
 * org's SLA config. Returns an ISO timestamp string or null if the priority
 * has no SLA configured.
 */
export function calculateSlaDeadline(
  priority: ApprovalPriority,
  slaConfig: SlaConfig | null,
  createdAt?: Date,
): string | null {
  const config = slaConfig ?? DEFAULT_SLA_CONFIG;
  const minutes = config[priority];

  if (minutes === null || minutes === undefined) {
    return null;
  }

  const base = createdAt ?? new Date();
  const deadline = new Date(base.getTime() + minutes * 60 * 1000);
  return deadline.toISOString();
}

// ---------------------------------------------------------------------------
// SLA Breach Check
// ---------------------------------------------------------------------------

/**
 * Check whether a pending approval has breached its SLA deadline.
 * Returns true if the approval is pending, has an SLA deadline, and that
 * deadline is in the past.
 */
export function checkSlaBreach(approval: {
  status: string;
  sla_deadline: string | null;
  sla_breached: boolean;
}): boolean {
  if (approval.status !== "pending") return false;
  if (!approval.sla_deadline) return false;
  if (approval.sla_breached) return false; // already marked

  return new Date(approval.sla_deadline) < new Date();
}

// ---------------------------------------------------------------------------
// SLA Metrics
// ---------------------------------------------------------------------------

/**
 * Query approval_requests for SLA metrics within a date range.
 *
 * Returns total approvals, breach count, breach rate, average response time
 * in minutes, and per-priority breakdowns.
 */
export async function getSlaMetrics(
  orgId: string,
  dateRange: { from: string; to: string },
): Promise<SlaMetrics> {
  const admin = createAdminClient();

  // Fetch all approvals in the date range that have an SLA deadline
  const { data: approvals, error } = await admin
    .from("approval_requests")
    .select("priority, status, sla_deadline, sla_breached, created_at, decided_at")
    .eq("org_id", orgId)
    .gte("created_at", dateRange.from)
    .lte("created_at", dateRange.to)
    .not("sla_deadline", "is", null);

  if (error) {
    logger.error("[SLA] Failed to fetch SLA metrics:", error);
    return emptyMetrics();
  }

  const rows = approvals ?? [];

  // Also fetch all approvals (with or without SLA) for response time calc
  const { data: allApprovals } = await admin
    .from("approval_requests")
    .select("priority, created_at, decided_at")
    .eq("org_id", orgId)
    .gte("created_at", dateRange.from)
    .lte("created_at", dateRange.to)
    .not("decided_at", "is", null)
    .in("status", ["approved", "rejected"]);

  const decidedRows = allApprovals ?? [];

  const priorities: ApprovalPriority[] = ["low", "medium", "high", "critical"];

  // Overall SLA stats
  const total = rows.length;
  const breached = rows.filter((r) => r.sla_breached === true).length;
  const breachRate = total > 0 ? Math.round((breached / total) * 10000) / 100 : 0;

  // Average response time across all decided approvals
  const avgResponseTimeMinutes = calculateAvgResponseMinutes(decidedRows);

  // Per-priority breakdown
  const perPriority = {} as SlaMetrics["per_priority"];
  for (const p of priorities) {
    const pRows = rows.filter((r) => r.priority === p);
    const pBreached = pRows.filter((r) => r.sla_breached === true).length;
    const pTotal = pRows.length;
    const pDecided = decidedRows.filter((r) => r.priority === p);

    perPriority[p] = {
      total: pTotal,
      breached: pBreached,
      breach_rate: pTotal > 0 ? Math.round((pBreached / pTotal) * 10000) / 100 : 0,
      avg_response_time_minutes: calculateAvgResponseMinutes(pDecided),
    };
  }

  // Daily trend: tracked vs breached per day
  const trendMap = new Map<string, { tracked: number; breached: number }>();
  const fromDate = new Date(dateRange.from);
  const toDate = new Date(dateRange.to);
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    trendMap.set(d.toISOString().slice(0, 10), { tracked: 0, breached: 0 });
  }
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    const entry = trendMap.get(day);
    if (entry) {
      entry.tracked++;
      if (r.sla_breached) entry.breached++;
    }
  }
  const dailyTrend: SlaDailyTrendPoint[] = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return {
    total,
    breached,
    breach_rate: breachRate,
    avg_response_time_minutes: avgResponseTimeMinutes,
    per_priority: perPriority,
    daily_trend: dailyTrend,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateAvgResponseMinutes(
  rows: Array<{ created_at: string; decided_at: string | null }>,
): number {
  const decided = rows.filter((r) => r.decided_at);
  if (decided.length === 0) return 0;

  const totalMs = decided.reduce((sum, row) => {
    const created = new Date(row.created_at).getTime();
    const decidedAt = new Date(row.decided_at!).getTime();
    return sum + (decidedAt - created);
  }, 0);

  return Math.round((totalMs / decided.length / 60_000) * 100) / 100;
}

function emptyMetrics(): SlaMetrics {
  const priorities: ApprovalPriority[] = ["low", "medium", "high", "critical"];
  const perPriority = {} as SlaMetrics["per_priority"];
  for (const p of priorities) {
    perPriority[p] = {
      total: 0,
      breached: 0,
      breach_rate: 0,
      avg_response_time_minutes: 0,
    };
  }

  return {
    total: 0,
    breached: 0,
    breach_rate: 0,
    avg_response_time_minutes: 0,
    per_priority: perPriority,
    daily_trend: [],
  };
}
