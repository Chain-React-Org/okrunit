import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanLimits, isUnlimited } from "@/lib/billing/plans";
import { buildUsageAlertEmailHtml } from "@/lib/email/usage-alert";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import type { BillingPlan } from "@/lib/types/database";
import { logger } from "@/lib/monitoring/logger";

const FROM_EMAIL = process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

/**
 * POST /api/v1/billing/usage-alerts
 * Checks all orgs for usage approaching plan limits and sends alert emails.
 * Intended to be called by a cron job (e.g., daily).
 * Requires CRON_SECRET header for authentication.
 */
export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
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

  // Group alerts by org
  const alertsByOrg = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    const existing = alertsByOrg.get(alert.org_id) ?? [];
    existing.push(alert);
    alertsByOrg.set(alert.org_id, existing);
  }

  let emailsSent = 0;

  if (alertsByOrg.size > 0 && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    for (const [orgId, orgAlerts] of alertsByOrg) {
      // Get org name and owner/admin emails
      const [{ data: org }, { data: members }] = await Promise.all([
        admin.from("organizations").select("name").eq("id", orgId).single(),
        admin
          .from("org_memberships")
          .select("user_id, role")
          .eq("org_id", orgId)
          .in("role", ["owner", "admin"]),
      ]);

      if (!org || !members || members.length === 0) continue;

      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("email")
        .in("id", userIds);

      if (!profiles || profiles.length === 0) continue;

      const html = buildUsageAlertEmailHtml({
        orgName: org.name,
        alerts: orgAlerts.map((a) => ({ type: a.type, current: a.current, limit: a.limit })),
        plan: orgAlerts[0].plan,
      });

      for (const profile of profiles) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: profile.email,
            subject: `Usage Alert: ${org.name} is approaching plan limits`,
            html,
          });
          emailsSent++;
        } catch (err) {
          logger.error(`[Usage Alerts] Failed to send to ${profile.email}:`, err);
        }
      }
    }
  }

  return NextResponse.json({
    alerts_found: alerts.length,
    orgs_affected: alertsByOrg.size,
    emails_sent: emailsSent,
  });
}
