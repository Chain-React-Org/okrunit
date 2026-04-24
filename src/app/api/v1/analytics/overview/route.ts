// ---------------------------------------------------------------------------
// OKrunit -- Analytics Overview API: GET (dashboard overview metrics)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { canUseFeature } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";
import { titleCaseName } from "@/lib/format-name";
// ---- Validation -----------------------------------------------------------

const overviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

// ---- Helpers --------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function responseTimeMinutes(createdAt: string, decidedAt: string): number {
  const created = new Date(createdAt).getTime();
  const decided = new Date(decidedAt).getTime();
  return Math.round(((decided - created) / 60_000) * 100) / 100;
}

// ---- Types ----------------------------------------------------------------

interface PeriodMetrics {
  total_requests: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  expired_count: number;
  cancelled_count: number;
  avg_decision_time_minutes: number;
  median_decision_time_minutes: number;
  sla_compliance_rate: number;
  auto_approved_count: number;
  approval_rate: number;
}

interface Bottleneck {
  user_id: string;
  display_name: string;
  avg_decision_time_minutes: number;
  pending_count: number;
}

// ---- Period metrics computation -------------------------------------------

async function computeMetrics(
  orgId: string,
  from: string,
  to: string,
): Promise<PeriodMetrics> {
  const admin = createAdminClient();

  const { data: approvals } = await admin
    .from("approval_requests")
    .select("status, created_at, decided_at, sla_deadline, sla_breached, auto_approved")
    .eq("org_id", orgId)
    .gte("created_at", from)
    .lte("created_at", to);

  const rows = approvals ?? [];

  const counts = {
    total: rows.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    cancelled: 0,
    auto_approved: 0,
  };

  const decisionTimes: number[] = [];
  let slaTracked = 0;
  let slaCompliant = 0;

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
      case "expired":
        counts.expired++;
        break;
      case "cancelled":
        counts.cancelled++;
        break;
    }

    if (row.auto_approved) {
      counts.auto_approved++;
    }

    if (
      (row.status === "approved" || row.status === "rejected") &&
      row.decided_at
    ) {
      decisionTimes.push(responseTimeMinutes(row.created_at, row.decided_at));
    }

    // SLA compliance: only count rows that have an SLA deadline
    if (row.sla_deadline) {
      slaTracked++;
      if (!row.sla_breached) {
        slaCompliant++;
      }
    }
  }

  const decided = counts.approved + counts.rejected;
  const approvalRate =
    decided > 0 ? Math.round((counts.approved / decided) * 100) / 100 : 0;

  const avgDecisionTime =
    decisionTimes.length > 0
      ? Math.round(
          (decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length) *
            100,
        ) / 100
      : 0;

  const medianDecisionTime = Math.round(median(decisionTimes) * 100) / 100;

  const slaComplianceRate =
    slaTracked > 0
      ? Math.round((slaCompliant / slaTracked) * 100) / 100
      : 1;

  return {
    total_requests: counts.total,
    pending_count: counts.pending,
    approved_count: counts.approved,
    rejected_count: counts.rejected,
    expired_count: counts.expired,
    cancelled_count: counts.cancelled,
    avg_decision_time_minutes: avgDecisionTime,
    median_decision_time_minutes: medianDecisionTime,
    sla_compliance_rate: slaComplianceRate,
    auto_approved_count: counts.auto_approved,
    approval_rate: approvalRate,
  };
}

// ---- Bottleneck detection -------------------------------------------------

async function computeBottlenecks(
  orgId: string,
  from: string,
  to: string,
  limit: number = 5,
): Promise<Bottleneck[]> {
  const admin = createAdminClient();

  // Get decided requests with their decision times
  const { data: decided } = await admin
    .from("approval_requests")
    .select("decided_by, created_at, decided_at")
    .eq("org_id", orgId)
    .not("decided_by", "is", null)
    .not("decided_at", "is", null)
    .in("status", ["approved", "rejected"])
    .gte("created_at", from)
    .lte("created_at", to);

  // Build per-user stats for decided requests
  const userStats = new Map<
    string,
    { totalMinutes: number; count: number; pendingCount: number }
  >();

  for (const row of decided ?? []) {
    const userId = row.decided_by!;
    if (!userStats.has(userId)) {
      userStats.set(userId, { totalMinutes: 0, count: 0, pendingCount: 0 });
    }
    const entry = userStats.get(userId)!;
    entry.totalMinutes += responseTimeMinutes(row.created_at, row.decided_at!);
    entry.count++;
  }

  // Pending counts per user (from assigned_to, not decided_by)
  // Note: pending requests typically have decided_by as null since they
  // have not been decided yet. Let's also check for assigned pending items.
  const { data: assignedPending } = await admin
    .from("approval_requests")
    .select("assigned_to")
    .eq("org_id", orgId)
    .eq("status", "pending");

  const pendingByUser = new Map<string, number>();
  for (const row of assignedPending ?? []) {
    if (row.assigned_to) {
      const userIds: string[] = Array.isArray(row.assigned_to)
        ? row.assigned_to
        : [row.assigned_to];
      for (const uid of userIds) {
        pendingByUser.set(uid, (pendingByUser.get(uid) ?? 0) + 1);
      }
    }
  }

  // Merge pending counts into stats and also include users who only have pending
  for (const [userId, count] of pendingByUser) {
    if (!userStats.has(userId)) {
      userStats.set(userId, { totalMinutes: 0, count: 0, pendingCount: count });
    } else {
      userStats.get(userId)!.pendingCount = count;
    }
  }

  if (userStats.size === 0) return [];

  // Fetch user display names
  const userIds = Array.from(userStats.keys());
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const nameMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameMap.set(p.id, titleCaseName(p.full_name) || p.email);
  }

  // Build and sort by avg decision time descending
  return Array.from(userStats.entries())
    .filter(([, stats]) => stats.count > 0 || stats.pendingCount > 0)
    .map(([userId, stats]) => ({
      user_id: userId,
      display_name: nameMap.get(userId) ?? "Unknown",
      avg_decision_time_minutes:
        stats.count > 0
          ? Math.round((stats.totalMinutes / stats.count) * 100) / 100
          : 0,
      pending_count: stats.pendingCount,
    }))
    .sort((a, b) => b.avg_decision_time_minutes - a.avg_decision_time_minutes)
    .slice(0, limit);
}

// ---- GET /api/v1/analytics/overview --------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate (session only for dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access analytics overview",
        "SESSION_REQUIRED",
      );
    }

    const orgId = auth.orgId;

    const featureCheck = await canUseFeature(orgId, "analytics");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Upgrade required for analytics", "PLAN_LIMIT_EXCEEDED");
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days") ?? "7";
    const { days } = overviewQuerySchema.parse({ days: daysParam });

    // 3. Compute date ranges
    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const prevPeriodEnd = periodStart;
    const prevPeriodStart = new Date(
      now.getTime() - days * 2 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 4. Run current, previous, and bottleneck queries in parallel
    const [metrics, prevMetrics, topBottlenecks] = await Promise.all([
      computeMetrics(orgId, periodStart, periodEnd),
      computeMetrics(orgId, prevPeriodStart, prevPeriodEnd),
      computeBottlenecks(orgId, periodStart, periodEnd),
    ]);

    // 5. Return response with cache headers
    return NextResponse.json(
      {
        period: {
          from: periodStart,
          to: periodEnd,
        },
        metrics,
        previous_period: {
          total_requests: prevMetrics.total_requests,
          avg_decision_time_minutes: prevMetrics.avg_decision_time_minutes,
          sla_compliance_rate: prevMetrics.sla_compliance_rate,
        },
        top_bottlenecks: topBottlenecks,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
