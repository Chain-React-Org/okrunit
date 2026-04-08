import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildConfirmEmailHtml } from "@/lib/email/confirm";
import { buildInviteEmailHtml } from "@/lib/email/invite";
import { buildWelcomeEmailHtml } from "@/lib/email/welcome";
import { buildUsageAlertEmailHtml } from "@/lib/email/usage-alert";
import { buildWeeklyDigestEmailHtml } from "@/lib/email/weekly-digest";
import { buildAccountDeletionEmailHtml } from "@/lib/email/account-deletion";
import { buildApprovalEmailHtml, buildDecisionEmailHtml } from "@/lib/notifications/channels/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET() {
  // Auth check - admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_app_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_app_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const previews = [
    // Onboarding
    {
      id: "signup-confirmation",
      name: "Signup Confirmation",
      description: "Sent when a user signs up - asks them to verify their email address.",
      category: "Onboarding",
      html: buildConfirmEmailHtml({
        fullName: "Sarah Chen",
        confirmLink: `${APP_URL}/callback?code=sample_confirmation_code`,
      }),
    },
    {
      id: "welcome",
      name: "Welcome",
      description: "Sent after a user confirms their email and signs in for the first time.",
      category: "Onboarding",
      html: buildWelcomeEmailHtml({
        fullName: "Sarah",
      }),
    },
    {
      id: "team-invite",
      name: "Team Invite",
      description: "Sent when an admin invites someone to join their organization.",
      category: "Onboarding",
      html: buildInviteEmailHtml({
        orgName: "Acme Corp",
        role: "admin",
        inviteLink: `${APP_URL}/invite/sample_invite_token`,
      }),
    },

    // Approvals
    {
      id: "approval-request",
      name: "Approval Request",
      description: "Sent when a new approval request needs review. Includes one-click actions.",
      category: "Approvals",
      html: buildApprovalEmailHtml({
        to: "reviewer@acme.com",
        subject: "Approval needed: Deploy v2.4.0 to production",
        requestId: "req_abc123",
        title: "Deploy v2.4.0 to production",
        description: "Routine release with bug-fixes and minor UI tweaks. Includes database migration for new user preferences table.",
        priority: "high",
        approveToken: "tok_approve_sample",
        rejectToken: "tok_reject_sample",
      }),
    },
    {
      id: "approval-request-critical",
      name: "Approval Request (Critical)",
      description: "Critical priority approval request with elevated urgency.",
      category: "Approvals",
      html: buildApprovalEmailHtml({
        to: "reviewer@acme.com",
        subject: "CRITICAL: Delete production database backup",
        requestId: "req_def456",
        title: "Delete production database backup",
        description: "Requested by automated cleanup pipeline. This will permanently remove the 30-day-old backup snapshot for us-east-1.",
        priority: "critical",
        approveToken: "tok_approve_sample2",
        rejectToken: "tok_reject_sample2",
      }),
    },
    {
      id: "decision-approved",
      name: "Decision - Approved",
      description: "Sent when a request is approved, including the reviewer's comment.",
      category: "Approvals",
      html: buildDecisionEmailHtml({
        to: "developer@acme.com",
        subject: "Approved: Deploy v2.4.0 to production",
        requestTitle: "Deploy v2.4.0 to production",
        decision: "approved",
        decidedBy: "Sarah Chen",
        comment: "Looks good! Checked the migration scripts and they're safe to run. Ship it.",
      }),
    },
    {
      id: "decision-rejected",
      name: "Decision - Rejected",
      description: "Sent when a request is rejected with reasoning from the reviewer.",
      category: "Approvals",
      html: buildDecisionEmailHtml({
        to: "developer@acme.com",
        subject: "Rejected: Delete production database backup",
        requestTitle: "Delete production database backup",
        decision: "rejected",
        decidedBy: "Alex Rivera",
        comment: "We need to retain backups for at least 90 days per our compliance policy. Please update the retention window.",
      }),
    },

    // Billing
    {
      id: "usage-alert",
      name: "Usage Alert",
      description: "Sent to org admins when usage is approaching plan limits.",
      category: "Billing",
      html: buildUsageAlertEmailHtml({
        orgName: "Acme Corp",
        plan: "Pro",
        alerts: [
          { type: "requests", current: 465, limit: 500 },
          { type: "connections", current: 9, limit: 10 },
          { type: "team_members", current: 14, limit: 15 },
        ],
      }),
    },

    // Reports
    {
      id: "weekly-digest",
      name: "Weekly Digest",
      description: "Weekly summary of org activity with analytics metrics, trend comparison, and top sources.",
      category: "Reports",
      html: buildWeeklyDigestEmailHtml({
        fullName: "Sarah",
        orgName: "Acme Corp",
        periodStart: "Mar 31",
        periodEnd: "Apr 7, 2026",
        stats: {
          totalRequests: 47,
          approved: 38,
          rejected: 5,
          pending: 4,
          avgResponseTimeHours: 1.8,
        },
        topConnections: [
          { name: "Zapier - Production", count: 18 },
          { name: "GitHub Actions CI", count: 14 },
          { name: "n8n Staging Workflows", count: 9 },
          { name: "Make.com Automations", count: 6 },
        ],
        analytics: {
          avgDecisionTimeMinutes: 108,
          medianDecisionTimeMinutes: 95,
          avgDecisionTimeChangePercent: -18.2,
          slaComplianceRate: 0.92,
          autoApprovedCount: 12,
          escalatedCount: 3,
          topBottleneckName: "Alex Rivera",
          topBottleneckAvgMinutes: 245,
        },
      }),
    },

    // Account
    {
      id: "account-deletion",
      name: "Account Deletion",
      description: "Sent when a user requests account deletion. Contains confirmation link.",
      category: "Account",
      html: buildAccountDeletionEmailHtml({
        confirmLink: `${APP_URL}/api/v1/account/delete/confirm?token=sample_deletion_token`,
        graceDays: 30,
        expiryHours: 24,
      }),
    },
  ];

  return NextResponse.json({ previews });
}
