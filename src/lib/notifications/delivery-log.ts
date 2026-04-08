// ---------------------------------------------------------------------------
// OKrunit -- Notification Delivery Log
// ---------------------------------------------------------------------------
//
// Logs every notification dispatch attempt (sent, failed, suppressed) to
// the notification_delivery_log table. Used for debugging "I didn't get
// notified" issues and for delivery analytics.
//
// This module is fire-and-forget by design. Logging failures never break
// the notification flow.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

export interface DeliveryLogEntry {
  orgId: string;
  requestId?: string;
  recipientUserId?: string;
  channel: "email" | "slack" | "discord" | "teams" | "telegram" | "web_push" | "webhook" | "sms";
  status: "sent" | "failed" | "suppressed";
  suppressionReason?: string;
  errorMessage?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a single notification delivery attempt. This is fire-and-forget;
 * errors are caught and logged to the console so they never block or break
 * the notification dispatch pipeline.
 */
export async function logNotificationDelivery(entry: DeliveryLogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notification_delivery_log").insert({
      org_id: entry.orgId,
      request_id: entry.requestId ?? null,
      recipient_user_id: entry.recipientUserId ?? null,
      channel: entry.channel,
      status: entry.status,
      suppression_reason: entry.suppressionReason ?? null,
      error_message: entry.errorMessage ?? null,
      external_id: entry.externalId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    // Never let delivery logging break the notification flow
    console.error("[DeliveryLog] Failed to log notification delivery:", err);
  }
}

/**
 * Log multiple delivery entries in a single batch insert. Used when
 * logging several suppressions or results at once.
 */
export async function logNotificationDeliveryBatch(entries: DeliveryLogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("notification_delivery_log").insert(
      entries.map((entry) => ({
        org_id: entry.orgId,
        request_id: entry.requestId ?? null,
        recipient_user_id: entry.recipientUserId ?? null,
        channel: entry.channel,
        status: entry.status,
        suppression_reason: entry.suppressionReason ?? null,
        error_message: entry.errorMessage ?? null,
        external_id: entry.externalId ?? null,
        metadata: entry.metadata ?? {},
      })),
    );
  } catch (err) {
    console.error("[DeliveryLog] Failed to batch-log notification deliveries:", err);
  }
}
