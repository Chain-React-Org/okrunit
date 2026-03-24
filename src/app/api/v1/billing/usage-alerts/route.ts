import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanLimits, isUnlimited } from "@/lib/billing/plans";
import type { BillingPlan } from "@/lib/types/database";

/**
 * POST /api/v1/billing/usage-alerts
 * Checks all orgs for usage approaching plan limits and sends alert emails.
 * Intended to be called by a cron job (e.g., daily).
 * Requires CRON_SECRET header for authentication.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Get all active subscriptions with their org details
  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("org_id, plan_id, status")
    .eq("status", "active");

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ alerts_sent: 0 });
  }

  const alerts: { org_id: string; plan: string; type: string; current: number; limit: number }[] = [];

  for (const sub of subscriptions) {
    const plan = sub.plan_id as BillingPlan;
    const limits = getPlanLimits(plan);

    // Check request usage
    if (!isUnlimited(limits.maxRequests)) {
      const { count } = await admin
        .from("approval_requests")
        .select("*", { count: "exact", head: true })
        .eq("org_id", sub.org_id)
        .gte("created_at", periodStart);

      const usage = count ?? 0;
      const pct = (usage / limits.maxRequests) * 100;

      if (pct >= 80) {
        alerts.push({
          org_id: sub.org_id,
          plan,
          type: "requests",
          current: usage,
          limit: limits.maxRequests,
        });
      }
    }

    // Check connection count
    if (!isUnlimited(limits.maxConnections)) {
      const { count } = await admin
        .from("connections")
        .select("*", { count: "exact", head: true })
        .eq("org_id", sub.org_id)
        .eq("is_active", true);

      const usage = count ?? 0;
      if (usage >= limits.maxConnections - 1) {
        alerts.push({
          org_id: sub.org_id,
          plan,
          type: "connections",
          current: usage,
          limit: limits.maxConnections,
        });
      }
    }

    // Check team member count
    if (!isUnlimited(limits.maxTeamMembers)) {
      const { count } = await admin
        .from("org_memberships")
        .select("*", { count: "exact", head: true })
        .eq("org_id", sub.org_id);

      const usage = count ?? 0;
      if (usage >= limits.maxTeamMembers - 1) {
        alerts.push({
          org_id: sub.org_id,
          plan,
          type: "team_members",
          current: usage,
          limit: limits.maxTeamMembers,
        });
      }
    }
  }

  // TODO: Send alert emails via Resend to org owners
  // For now, just log and return the alerts
  if (alerts.length > 0) {
    console.log(`[Usage Alerts] ${alerts.length} alerts for ${new Set(alerts.map(a => a.org_id)).size} orgs`);
  }

  return NextResponse.json({
    alerts_sent: alerts.length,
    alerts,
  });
}
