import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWeeklyDigestEmailHtml } from "@/lib/email/weekly-digest";
import type { WeeklyDigestAnalytics } from "@/lib/email/weekly-digest";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import { logger } from "@/lib/monitoring/logger";

const FROM_EMAIL = process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

/**
 * GET /api/v1/cron/weekly-digest
 * Sends weekly digest emails to all org members with email enabled.
 * Should be run weekly (e.g., Monday 9am UTC).
 */
export async function GET(req: NextRequest) {
  return handleDigest(req);
}

// ---- Helpers --------------------------------------------------------------

function responseTimeMinutes(createdAt: string, decidedAt: string): number {
  const created = new Date(createdAt).getTime();
  const decided = new Date(decidedAt).getTime();
  return Math.round(((decided - created) / 60_000) * 100) / 100;
}

/**
 * Compute analytics metrics for a single org within a date range.
 * Also computes previous-period avg decision time for trend comparison.
 */
async function computeOrgAnalytics(
  orgId: string,
  from: Date,
  to: Date,
): Promise<WeeklyDigestAnalytics> {
  const admin = createAdminClient();

  // Previous period (same duration, shifted back)
  const duration = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - duration);
  const prevTo = from;

  // Current period: decided requests, auto-approved, SLA, escalations
  const [
    { data: decidedCurrent },
    { data: decidedPrev },
    { data: slaRows },
    { count: autoApprovedCount },
    { count: escalatedCount },
  ] = await Promise.all([
    admin
      .from("approval_requests")
      .select("decided_by, created_at, decided_at")
      .eq("org_id", orgId)
      .not("decided_at", "is", null)
      .in("status", ["approved", "rejected"])
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
    admin
      .from("approval_requests")
      .select("created_at, decided_at")
      .eq("org_id", orgId)
      .not("decided_at", "is", null)
      .in("status", ["approved", "rejected"])
      .gte("created_at", prevFrom.toISOString())
      .lte("created_at", prevTo.toISOString()),
    admin
      .from("approval_requests")
      .select("sla_deadline, sla_breached")
      .eq("org_id", orgId)
      .not("sla_deadline", "is", null)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("auto_approved", true)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gt("escalation_level", 0)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString()),
  ]);

  // Compute current avg and median decision time
  const currentTimes: number[] = [];
  for (const row of decidedCurrent ?? []) {
    if (row.decided_at) {
      currentTimes.push(responseTimeMinutes(row.created_at, row.decided_at));
    }
  }

  const avgDecisionTimeMinutes =
    currentTimes.length > 0
      ? Math.round((currentTimes.reduce((a, b) => a + b, 0) / currentTimes.length) * 100) / 100
      : 0;

  const sortedTimes = [...currentTimes].sort((a, b) => a - b);
  let medianDecisionTimeMinutes = 0;
  if (sortedTimes.length > 0) {
    const mid = Math.floor(sortedTimes.length / 2);
    medianDecisionTimeMinutes =
      sortedTimes.length % 2 === 0
        ? Math.round(((sortedTimes[mid - 1] + sortedTimes[mid]) / 2) * 100) / 100
        : Math.round(sortedTimes[mid] * 100) / 100;
  }

  // Compute previous period avg for trend comparison
  const prevTimes: number[] = [];
  for (const row of decidedPrev ?? []) {
    if (row.decided_at) {
      prevTimes.push(responseTimeMinutes(row.created_at, row.decided_at));
    }
  }

  let avgDecisionTimeChangePercent: number | null = null;
  if (prevTimes.length > 0 && currentTimes.length > 0) {
    const prevAvg = prevTimes.reduce((a, b) => a + b, 0) / prevTimes.length;
    if (prevAvg > 0) {
      avgDecisionTimeChangePercent =
        Math.round(((avgDecisionTimeMinutes - prevAvg) / prevAvg) * 10000) / 100;
    }
  }

  // SLA compliance
  const slaTotal = (slaRows ?? []).length;
  const slaCompliant = (slaRows ?? []).filter((r) => !r.sla_breached).length;
  const slaComplianceRate = slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 100) / 100 : 1;

  // Top bottleneck: slowest approver by avg decision time
  const userTimesMap = new Map<string, number[]>();
  for (const row of decidedCurrent ?? []) {
    if (row.decided_by && row.decided_at) {
      if (!userTimesMap.has(row.decided_by)) {
        userTimesMap.set(row.decided_by, []);
      }
      userTimesMap.get(row.decided_by)!.push(
        responseTimeMinutes(row.created_at, row.decided_at),
      );
    }
  }

  let topBottleneckName: string | null = null;
  let topBottleneckAvgMinutes: number | null = null;

  if (userTimesMap.size > 0) {
    // Find the user with the highest average decision time
    let slowestUserId: string | null = null;
    let slowestAvg = 0;

    for (const [userId, times] of userTimesMap) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      if (avg > slowestAvg) {
        slowestAvg = avg;
        slowestUserId = userId;
      }
    }

    if (slowestUserId) {
      topBottleneckAvgMinutes = Math.round(slowestAvg * 100) / 100;

      const { data: profile } = await admin
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", slowestUserId)
        .single();

      topBottleneckName = profile?.full_name || profile?.email || "Unknown";
    }
  }

  return {
    avgDecisionTimeMinutes,
    medianDecisionTimeMinutes,
    avgDecisionTimeChangePercent,
    slaComplianceRate,
    autoApprovedCount: autoApprovedCount ?? 0,
    escalatedCount: escalatedCount ?? 0,
    topBottleneckName,
    topBottleneckAvgMinutes,
  };
}

// ---- Main handler ---------------------------------------------------------

async function handleDigest(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const periodStart = weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const periodEnd = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Get all orgs
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ digests_sent: 0 });
  }

  let totalSent = 0;

  for (const org of orgs) {
    // Get this week's stats
    const [
      { count: totalRequests },
      { count: approved },
      { count: rejected },
      { count: pending },
      { data: decidedRequests },
    ] = await Promise.all([
      admin
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .gte("created_at", weekAgo.toISOString()),
      admin
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "approved")
        .gte("created_at", weekAgo.toISOString()),
      admin
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "rejected")
        .gte("created_at", weekAgo.toISOString()),
      admin
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "pending"),
      admin
        .from("approval_requests")
        .select("created_at, decided_at")
        .eq("org_id", org.id)
        .not("decided_at", "is", null)
        .gte("created_at", weekAgo.toISOString()),
    ]);

    // Skip orgs with no activity
    if ((totalRequests ?? 0) === 0 && (pending ?? 0) === 0) continue;

    // Calculate avg response time
    let avgResponseTimeHours: number | null = null;
    if (decidedRequests && decidedRequests.length > 0) {
      const totalMs = decidedRequests.reduce((sum, r) => {
        const created = new Date(r.created_at).getTime();
        const decided = new Date(r.decided_at!).getTime();
        return sum + (decided - created);
      }, 0);
      avgResponseTimeHours = Math.round((totalMs / decidedRequests.length / 3600000) * 10) / 10;
    }

    // Compute analytics metrics for this org
    let analytics: WeeklyDigestAnalytics | undefined;
    try {
      analytics = await computeOrgAnalytics(org.id, weekAgo, now);
    } catch (err) {
      logger.error(`[Weekly Digest] Failed to compute analytics for org ${org.id}:`, err);
    }

    // Get top connections by request count
    const { data: connectionStats } = await admin
      .from("approval_requests")
      .select("connection_id")
      .eq("org_id", org.id)
      .not("connection_id", "is", null)
      .gte("created_at", weekAgo.toISOString());

    const connCounts = new Map<string, number>();
    for (const r of connectionStats ?? []) {
      if (r.connection_id) {
        connCounts.set(r.connection_id, (connCounts.get(r.connection_id) ?? 0) + 1);
      }
    }

    const topConnIds = [...connCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let topConnections: { name: string; count: number }[] = [];
    if (topConnIds.length > 0) {
      const { data: connections } = await admin
        .from("connections")
        .select("id, name")
        .in("id", topConnIds.map(([id]) => id));

      const nameMap = new Map((connections ?? []).map((c) => [c.id, c.name]));
      topConnections = topConnIds.map(([id, count]) => ({
        name: nameMap.get(id) ?? "Unknown",
        count,
      }));
    }

    // Get org members with email enabled
    const { data: members } = await admin
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", org.id);

    if (!members || members.length === 0) continue;

    const userIds = members.map((m) => m.user_id);

    // Check notification settings: only send to users with email enabled
    const { data: settings } = await admin
      .from("notification_settings")
      .select("user_id, email_enabled")
      .in("user_id", userIds);

    const disabledUsers = new Set(
      (settings ?? []).filter((s) => s.email_enabled === false).map((s) => s.user_id)
    );

    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, email, full_name")
      .in("id", userIds)
      .is("deletion_scheduled_at", null);

    if (!profiles) continue;

    const stats = {
      totalRequests: totalRequests ?? 0,
      approved: approved ?? 0,
      rejected: rejected ?? 0,
      pending: pending ?? 0,
      avgResponseTimeHours,
    };

    for (const profile of profiles) {
      if (disabledUsers.has(profile.id)) continue;

      try {
        const html = buildWeeklyDigestEmailHtml({
          fullName: profile.full_name || "there",
          orgName: org.name,
          periodStart,
          periodEnd,
          stats,
          topConnections,
          analytics,
        });

        await resend.emails.send({
          from: FROM_EMAIL,
          to: profile.email,
          subject: `Weekly Digest: ${org.name}`,
          html,
        });
        totalSent++;
      } catch (err) {
        logger.error(`[Weekly Digest] Failed to send to ${profile.email}:`, err);
      }
    }
  }

  return NextResponse.json({ digests_sent: totalSent });
}
