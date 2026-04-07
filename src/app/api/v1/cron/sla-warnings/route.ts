// ---------------------------------------------------------------------------
// OKrunit -- Cron: SLA Deadline Warnings
// ---------------------------------------------------------------------------
// Runs every 2 minutes. Finds pending approval requests that have used 75%+
// of their SLA time but haven't breached yet, and sends warning notifications
// to assigned approvers so they can act before the deadline.
//
// Auth: x-cron-secret header
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotifications } from "@/lib/notifications/orchestrator";
import { createInAppNotificationBulk } from "@/lib/notifications/in-app";
import { captureError } from "@/lib/monitoring/capture";

function verifyCronAuth(request: Request): boolean {
  const xCronSecret = request.headers.get("x-cron-secret");
  if (xCronSecret && xCronSecret === process.env.CRON_SECRET) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

export async function GET(request: Request) {
  return handleSlaWarnings(request);
}

export async function POST(request: Request) {
  return handleSlaWarnings(request);
}

async function handleSlaWarnings(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();

  // Fetch all pending requests with SLA deadlines where warning hasn't been sent
  const { data: requests, error } = await admin
    .from("approval_requests")
    .select(
      "id, org_id, title, priority, sla_deadline, created_at, connection_id, assigned_approvers, source, action_type",
    )
    .eq("status", "pending")
    .eq("sla_breached", false)
    .eq("sla_warning_sent", false)
    .not("sla_deadline", "is", null)
    .limit(200);

  if (error) {
    captureError({ error, service: "sla-warnings-cron", severity: "error" });
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json({ warned: 0 });
  }

  // Filter to requests that have used 75%+ of their SLA time
  const atRisk = requests.filter((r) => {
    const created = new Date(r.created_at).getTime();
    const deadline = new Date(r.sla_deadline!).getTime();
    const total = deadline - created;
    const elapsed = now - created;
    return total > 0 && elapsed / total >= 0.75;
  });

  if (atRisk.length === 0) {
    return NextResponse.json({ warned: 0 });
  }

  let warned = 0;

  for (const req of atRisk) {
    try {
      const approvers: string[] = req.assigned_approvers ?? [];

      // Dispatch to all notification channels (email, Slack, etc.)
      await dispatchNotifications({
        type: "approval.sla_warning",
        orgId: req.org_id,
        requestId: req.id,
        requestTitle: req.title,
        requestPriority: req.priority ?? "medium",
        connectionId: req.connection_id ?? undefined,
        source: req.source ?? undefined,
        actionType: req.action_type ?? undefined,
        targetUserIds: approvers.length > 0 ? approvers : undefined,
        assignedApprovers: approvers.length > 0 ? approvers : undefined,
      });

      // Create in-app notifications for approvers (or all org members if no specific approvers)
      if (approvers.length > 0) {
        await createInAppNotificationBulk(approvers, {
          orgId: req.org_id,
          category: "approval_expiring",
          title: "SLA deadline approaching",
          body: `"${req.title}" is close to breaching its SLA. Act soon to avoid a breach.`,
          resourceType: "approval_request",
          resourceId: req.id,
        });
      }

      // Mark warning as sent
      await admin
        .from("approval_requests")
        .update({ sla_warning_sent: true })
        .eq("id", req.id);

      warned++;
    } catch (err) {
      captureError({
        error: err instanceof Error ? err : new Error(String(err)),
        service: "sla-warnings-cron",
        severity: "warning",
        tags: { requestId: req.id },
      });
    }
  }

  return NextResponse.json({ warned, checked: atRisk.length });
}
