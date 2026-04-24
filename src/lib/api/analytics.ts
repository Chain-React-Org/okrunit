// ---------------------------------------------------------------------------
// OKrunit -- Analytics Query Functions
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { titleCaseName } from "@/lib/format-name";

// ---- Types ----------------------------------------------------------------

export interface AnalyticsSummary {
  total_approvals: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
  approval_rate: number;
  avg_response_time_minutes: number;
  median_response_time_minutes: number;
}

export interface DailyTrend {
  date: string;
  created: number;
  approved: number;
  rejected: number;
}

export interface SourceMetric {
  source: string;
  count: number;
  approval_rate: number;
}

export interface PriorityMetric {
  priority: string;
  count: number;
  avg_response_minutes: number;
}

export interface ActionTypeMetric {
  action_type: string;
  count: number;
}

export interface RejectionReasonMetric {
  reason: string;
  count: number;
}

export interface UserMetric {
  user_id: string;
  user_name: string;
  approved: number;
  rejected: number;
  avg_response_minutes: number;
}

export interface CostOfDelayItem {
  id: string;
  title: string;
  priority: string;
  age_minutes: number;
  estimated_impact: string | null;
  created_at: string;
  action_type: string | null;
  source: string | null;
}

// ---- Helpers --------------------------------------------------------------

function toDateRange(startDate: string, endDate: string) {
  return { start: startDate, end: endDate };
}

/**
 * Calculate median from a sorted array of numbers.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Compute response time in minutes between created_at and decided_at.
 */
function responseTimeMinutes(createdAt: string, decidedAt: string): number {
  const created = new Date(createdAt).getTime();
  const decided = new Date(decidedAt).getTime();
  return Math.round((decided - created) / 60_000 * 100) / 100;
}

// ---- Query Functions ------------------------------------------------------

/**
 * Get approval summary metrics within a date range.
 */
export async function getApprovalSummary(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<AnalyticsSummary> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  // Fetch all approvals in range with minimal columns
  const { data: approvals } = await admin
    .from("approval_requests")
    .select("status, created_at, decided_at")
    .eq("org_id", orgId)
    .gte("created_at", start)
    .lte("created_at", end);

  const rows = approvals ?? [];

  const counts = {
    total_approvals: rows.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    expired: 0,
  };

  const responseTimes: number[] = [];

  for (const row of rows) {
    switch (row.status) {
      case "pending":
        counts.pending++;
        break;
      case "approved":
        counts.approved++;
        break;
      case "rejected":
        counts.rejected++;
        break;
      case "cancelled":
        counts.cancelled++;
        break;
      case "expired":
        counts.expired++;
        break;
    }

    if (
      (row.status === "approved" || row.status === "rejected") &&
      row.decided_at
    ) {
      responseTimes.push(responseTimeMinutes(row.created_at, row.decided_at));
    }
  }

  const decided = counts.approved + counts.rejected;
  const approvalRate =
    decided > 0
      ? Math.round((counts.approved / decided) * 10_000) / 100
      : 0;

  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round(
          (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) *
            100,
        ) / 100
      : 0;

  const medianResponseTime = Math.round(median(responseTimes) * 100) / 100;

  return {
    ...counts,
    approval_rate: approvalRate,
    avg_response_time_minutes: avgResponseTime,
    median_response_time_minutes: medianResponseTime,
  };
}

/**
 * Get daily trend data for approvals within a date range.
 */
export async function getApprovalTrends(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<DailyTrend[]> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  // Fetch created approvals in range
  const { data: created } = await admin
    .from("approval_requests")
    .select("created_at, status")
    .eq("org_id", orgId)
    .gte("created_at", start)
    .lte("created_at", end);

  // Fetch decided approvals in range (decided_at within range)
  const { data: decided } = await admin
    .from("approval_requests")
    .select("decided_at, status")
    .eq("org_id", orgId)
    .not("decided_at", "is", null)
    .gte("decided_at", start)
    .lte("decided_at", end);

  // Build a map of date -> counts
  const dateMap = new Map<
    string,
    { created: number; approved: number; rejected: number }
  >();

  const ensureDate = (dateStr: string) => {
    const day = dateStr.slice(0, 10); // YYYY-MM-DD
    if (!dateMap.has(day)) {
      dateMap.set(day, { created: 0, approved: 0, rejected: 0 });
    }
    return dateMap.get(day)!;
  };

  for (const row of created ?? []) {
    ensureDate(row.created_at).created++;
  }

  for (const row of decided ?? []) {
    if (!row.decided_at) continue;
    const entry = ensureDate(row.decided_at);
    if (row.status === "approved") {
      entry.approved++;
    } else if (row.status === "rejected") {
      entry.rejected++;
    }
  }

  // Fill in missing dates in the range
  const startD = new Date(start);
  const endD = new Date(end);
  const current = new Date(startD);
  current.setUTCHours(0, 0, 0, 0);

  while (current <= endD) {
    const dayStr = current.toISOString().slice(0, 10);
    if (!dateMap.has(dayStr)) {
      dateMap.set(dayStr, { created: 0, approved: 0, rejected: 0 });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Sort by date and return
  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}

/**
 * Get approval counts and rates grouped by source.
 */
export async function getApprovalsBySource(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<SourceMetric[]> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  const { data: approvals } = await admin
    .from("approval_requests")
    .select("source, status")
    .eq("org_id", orgId)
    .gte("created_at", start)
    .lte("created_at", end);

  const sourceMap = new Map<
    string,
    { count: number; approved: number; decided: number }
  >();

  for (const row of approvals ?? []) {
    const source = row.source ?? "unknown";
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { count: 0, approved: 0, decided: 0 });
    }
    const entry = sourceMap.get(source)!;
    entry.count++;
    if (row.status === "approved" || row.status === "rejected") {
      entry.decided++;
      if (row.status === "approved") {
        entry.approved++;
      }
    }
  }

  return Array.from(sourceMap.entries())
    .map(([source, stats]) => ({
      source,
      count: stats.count,
      approval_rate:
        stats.decided > 0
          ? Math.round((stats.approved / stats.decided) * 10_000) / 100
          : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get approval counts and average response time grouped by priority.
 */
export async function getApprovalsByPriority(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<PriorityMetric[]> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  const { data: approvals } = await admin
    .from("approval_requests")
    .select("priority, status, created_at, decided_at")
    .eq("org_id", orgId)
    .gte("created_at", start)
    .lte("created_at", end);

  const priorityMap = new Map<
    string,
    { count: number; totalResponseMinutes: number; respondedCount: number }
  >();

  for (const row of approvals ?? []) {
    if (!priorityMap.has(row.priority)) {
      priorityMap.set(row.priority, {
        count: 0,
        totalResponseMinutes: 0,
        respondedCount: 0,
      });
    }
    const entry = priorityMap.get(row.priority)!;
    entry.count++;

    if (
      (row.status === "approved" || row.status === "rejected") &&
      row.decided_at
    ) {
      entry.totalResponseMinutes += responseTimeMinutes(
        row.created_at,
        row.decided_at,
      );
      entry.respondedCount++;
    }
  }

  const priorityOrder = ["critical", "high", "medium", "low"];

  return priorityOrder
    .filter((p) => priorityMap.has(p))
    .map((priority) => {
      const stats = priorityMap.get(priority)!;
      return {
        priority,
        count: stats.count,
        avg_response_minutes:
          stats.respondedCount > 0
            ? Math.round(
                (stats.totalResponseMinutes / stats.respondedCount) * 100,
              ) / 100
            : 0,
      };
    });
}

/**
 * Get approval counts grouped by action_type.
 */
export async function getApprovalsByActionType(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<ActionTypeMetric[]> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  const { data: approvals } = await admin
    .from("approval_requests")
    .select("action_type")
    .eq("org_id", orgId)
    .gte("created_at", start)
    .lte("created_at", end);

  const typeMap = new Map<string, number>();

  for (const row of approvals ?? []) {
    const actionType = row.action_type ?? "unspecified";
    typeMap.set(actionType, (typeMap.get(actionType) ?? 0) + 1);
  }

  return Array.from(typeMap.entries())
    .map(([action_type, count]) => ({ action_type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get top rejection reasons within a date range.
 */
export async function getTopRejectionReasons(
  orgId: string,
  startDate: string,
  endDate: string,
  limit: number = 10,
): Promise<RejectionReasonMetric[]> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  const { data: rejections } = await admin
    .from("approval_requests")
    .select("decision_comment")
    .eq("org_id", orgId)
    .eq("status", "rejected")
    .not("decision_comment", "is", null)
    .gte("created_at", start)
    .lte("created_at", end);

  const reasonMap = new Map<string, number>();

  for (const row of rejections ?? []) {
    if (row.decision_comment) {
      // Normalize: trim and lowercase for grouping
      const normalized = row.decision_comment.trim();
      if (normalized.length > 0) {
        reasonMap.set(normalized, (reasonMap.get(normalized) ?? 0) + 1);
      }
    }
  }

  return Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Get per-user approval/rejection metrics.
 */
export async function getPerUserMetrics(
  orgId: string,
  startDate: string,
  endDate: string,
): Promise<UserMetric[]> {
  const admin = createAdminClient();
  const { start, end } = toDateRange(startDate, endDate);

  // Fetch all decided approvals with decided_by
  const { data: approvals } = await admin
    .from("approval_requests")
    .select("decided_by, status, created_at, decided_at")
    .eq("org_id", orgId)
    .not("decided_by", "is", null)
    .in("status", ["approved", "rejected"])
    .gte("created_at", start)
    .lte("created_at", end);

  const userMap = new Map<
    string,
    {
      approved: number;
      rejected: number;
      totalResponseMinutes: number;
      respondedCount: number;
    }
  >();

  for (const row of approvals ?? []) {
    const userId = row.decided_by!;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        approved: 0,
        rejected: 0,
        totalResponseMinutes: 0,
        respondedCount: 0,
      });
    }
    const entry = userMap.get(userId)!;

    if (row.status === "approved") {
      entry.approved++;
    } else {
      entry.rejected++;
    }

    if (row.decided_at) {
      entry.totalResponseMinutes += responseTimeMinutes(
        row.created_at,
        row.decided_at,
      );
      entry.respondedCount++;
    }
  }

  // Fetch user names
  const userIds = Array.from(userMap.keys());
  if (userIds.length === 0) return [];

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameMap.set(p.id, titleCaseName(p.full_name) || p.email);
  }

  return Array.from(userMap.entries())
    .map(([userId, stats]) => ({
      user_id: userId,
      user_name: nameMap.get(userId) ?? "Unknown",
      approved: stats.approved,
      rejected: stats.rejected,
      avg_response_minutes:
        stats.respondedCount > 0
          ? Math.round(
              (stats.totalResponseMinutes / stats.respondedCount) * 100,
            ) / 100
          : 0,
    }))
    .sort((a, b) => b.approved + b.rejected - (a.approved + a.rejected));
}

/**
 * Get pending approvals with their age and estimated impact (cost of delay).
 */
export async function getCostOfDelay(
  orgId: string,
): Promise<CostOfDelayItem[]> {
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from("approval_requests")
    .select("id, title, priority, created_at, metadata, action_type, source")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const now = Date.now();

  return (pending ?? []).map((row) => {
    const ageMinutes =
      Math.round(((now - new Date(row.created_at).getTime()) / 60_000) * 100) /
      100;

    const metadata = row.metadata as Record<string, unknown> | null;
    const estimatedImpact =
      metadata && typeof metadata.estimated_impact === "string"
        ? metadata.estimated_impact
        : null;

    return {
      id: row.id,
      title: row.title,
      priority: row.priority,
      age_minutes: ageMinutes,
      estimated_impact: estimatedImpact,
      created_at: row.created_at,
      action_type: row.action_type,
      source: row.source,
    };
  });
}
