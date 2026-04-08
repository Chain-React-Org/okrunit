// ---------------------------------------------------------------------------
// OKrunit -- Generic Webhook Notification Channel
// ---------------------------------------------------------------------------
//
// Sends notification payloads to user-configured webhook URLs. Each org can
// define multiple webhook channels with custom URLs, headers, and event
// filters via the webhook_notification_channels table.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

export interface WebhookChannel {
  id: string;
  org_id: string;
  name: string;
  url: string;
  http_method: string;
  headers: Record<string, string>;
  payload_template: Record<string, unknown> | null;
  events: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookNotificationPayload {
  event_type: string;
  request_id: string;
  title: string;
  description?: string;
  priority: string;
  action_type?: string;
  status: string;
  approve_url: string;
  reject_url: string;
  dashboard_url: string;
  decided_by?: string;
  decision_comment?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Load all active webhook channels for an organization.
 */
export async function getOrgWebhookChannels(
  orgId: string,
): Promise<WebhookChannel[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("webhook_notification_channels")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    console.error(
      "[Webhook] Failed to load webhook channels:",
      error.message,
    );
    return [];
  }

  return (data as WebhookChannel[]) ?? [];
}

/**
 * Send a notification payload to a webhook channel endpoint.
 *
 * Merges the channel's custom headers with default headers. Uses the
 * channel's configured HTTP method (defaults to POST).
 *
 * Throws on non-2xx responses so the caller can log the failure.
 */
export async function sendWebhookNotification(
  channel: WebhookChannel,
  payload: WebhookNotificationPayload,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "OKrunit-Webhook/1.0",
    ...(channel.headers ?? {}),
  };

  const body = channel.payload_template
    ? mergePayloadTemplate(channel.payload_template, payload)
    : payload;

  const response = await fetch(channel.url, {
    method: channel.http_method || "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Webhook ${channel.name} returned ${response.status}: ${errorText.slice(0, 200)}`,
    );
  }
}

/**
 * Merge a user-defined payload template with the actual notification data.
 *
 * Template values that are strings containing `{{field_name}}` placeholders
 * get replaced with the corresponding value from the payload. Other template
 * values are passed through as-is.
 */
function mergePayloadTemplate(
  template: Record<string, unknown>,
  payload: WebhookNotificationPayload,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const payloadRecord = payload as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(template)) {
    if (typeof value === "string") {
      // Replace {{field}} placeholders
      result[key] = value.replace(
        /\{\{(\w+)\}\}/g,
        (_, field: string) => {
          const val = payloadRecord[field];
          return val !== undefined ? String(val) : "";
        },
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
