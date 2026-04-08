import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWeeklyDigestEmailHtml } from "@/lib/email/weekly-digest";
import { verifyCronAuth } from "@/lib/api/cron-auth";

const FROM_EMAIL = process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

/**
 * POST /api/v1/cron/weekly-digest
 * Sends weekly digest emails to all org members with email enabled.
 * Should be run weekly (e.g., Monday 9am UTC).
 */
export async function POST(req: NextRequest) {
  return handleDigest(req);
}

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
        });

        await resend.emails.send({
          from: FROM_EMAIL,
          to: profile.email,
          subject: `Weekly Digest: ${org.name}`,
          html,
        });
        totalSent++;
      } catch (err) {
        console.error(`[Weekly Digest] Failed to send to ${profile.email}:`, err);
      }
    }
  }

  return NextResponse.json({ digests_sent: totalSent });
}
