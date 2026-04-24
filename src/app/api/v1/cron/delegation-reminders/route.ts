// ---------------------------------------------------------------------------
// OKrunit -- Cron: Delegation Expiry Reminders
// ---------------------------------------------------------------------------
// Runs hourly. Finds active delegations whose ends_at falls in the next 24h
// and whose expiry_reminder_sent_at is null. Sends one in-app notification
// per delegation to the DELEGATOR nudging them to extend if still away, then
// stamps expiry_reminder_sent_at so the reminder only fires once.
//
// Auth: x-cron-secret header
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { captureError } from "@/lib/monitoring/capture";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import { titleCaseName } from "@/lib/format-name";

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: delegations, error } = await admin
    .from("approval_delegations")
    .select("id, org_id, delegator_id, delegate_id, ends_at")
    .eq("is_active", true)
    .is("expiry_reminder_sent_at", null)
    .gt("ends_at", now.toISOString())
    .lte("ends_at", in24h.toISOString())
    .limit(200);

  if (error) {
    captureError({ error, service: "delegation-reminders-cron", severity: "error" });
    return NextResponse.json({ error: "Failed to fetch delegations" }, { status: 500 });
  }

  if (!delegations || delegations.length === 0) {
    return NextResponse.json({ reminded: 0 });
  }

  // Resolve delegate display names in one query.
  const delegateIds = [...new Set(delegations.map((d) => d.delegate_id))];
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", delegateIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, titleCaseName(p.full_name) || p.email || "a teammate"]),
  );

  let reminded = 0;

  for (const d of delegations) {
    try {
      const delegateName = nameById.get(d.delegate_id) ?? "a teammate";
      const endLabel = new Date(d.ends_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      await createInAppNotification({
        userId: d.delegator_id,
        orgId: d.org_id,
        category: "delegation_expiring",
        title: "Your delegation ends in under 24 hours",
        body: `${delegateName} stops covering your approvals at ${endLabel}. Extend or cancel on the Delegation settings page.`,
        resourceType: "approval_delegation",
        resourceId: d.id,
      });

      await admin
        .from("approval_delegations")
        .update({ expiry_reminder_sent_at: now.toISOString() })
        .eq("id", d.id);

      reminded++;
    } catch (err) {
      captureError({
        error: err instanceof Error ? err : new Error(String(err)),
        service: "delegation-reminders-cron",
        severity: "warning",
        tags: { delegationId: d.id },
      });
    }
  }

  return NextResponse.json({ reminded, checked: delegations.length });
}
