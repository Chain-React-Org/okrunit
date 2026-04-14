// ---------------------------------------------------------------------------
// OKrunit -- Web Push Notification Channel (VAPID-signed)
// ---------------------------------------------------------------------------

import webPush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- VAPID Configuration ---------------------------------------------------

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@okrunit.com";

let vapidConfigured = false;

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
} else {
  console.warn(
    "[WebPush] VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable web push notifications.",
  );
}

// ---- Types -----------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requestId?: string;
  actions?: { action: string; title: string }[];
}

interface StoredSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ---- Send to a Single User -------------------------------------------------

/**
 * Send a web push notification to a specific user.
 * Fetches all their push subscriptions and sends to each.
 * Auto-cleans up 410 (gone) subscriptions that are no longer valid.
 */
export async function sendWebPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured) {
    console.warn("[WebPush] Skipping send -- VAPID keys not configured");
    return;
  }

  const admin = createAdminClient();

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[WebPush] Failed to fetch subscriptions for user:", userId, error);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return;
  }

  await sendToSubscriptions(admin, subscriptions as StoredSubscription[], payload);
}

// ---- Send to All Users in an Org -------------------------------------------

/**
 * Send web push to all users in an organization.
 */
export async function sendWebPushToOrg(
  orgId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured) {
    console.warn("[WebPush] Skipping send -- VAPID keys not configured");
    return;
  }

  const admin = createAdminClient();

  // 1. Get all user IDs in this org via org_memberships
  const { data: memberships, error: memberError } = await admin
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", orgId);

  if (memberError || !memberships || memberships.length === 0) {
    if (memberError) {
      console.error("[WebPush] Failed to fetch org members:", orgId, memberError);
    }
    return;
  }

  const userIds = memberships.map((m) => m.user_id);

  // 2. Get all push subscriptions for those users
  const { data: subscriptions, error: subError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subError) {
    console.error("[WebPush] Failed to fetch subscriptions for org:", orgId, subError);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return;
  }

  await sendToSubscriptions(admin, subscriptions as StoredSubscription[], payload);
}

// ---- Internal: Send to a List of Subscriptions -----------------------------

async function sendToSubscriptions(
  admin: ReturnType<typeof createAdminClient>,
  subscriptions: StoredSubscription[],
  payload: PushPayload,
): Promise<void> {
  const jsonPayload = JSON.stringify(payload);
  const staleIds: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webPush.sendNotification(pushSubscription, jsonPayload);
      } catch (err: unknown) {
        const statusCode =
          err instanceof webPush.WebPushError ? err.statusCode : undefined;

        if (statusCode === 410 || statusCode === 404) {
          // Subscription is no longer valid -- mark for cleanup
          staleIds.push(sub.id);
        } else {
          console.error(
            "[WebPush] Failed to send to endpoint:",
            sub.endpoint,
            err,
          );
        }
      }
    }),
  );

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    const { error: deleteError } = await admin
      .from("push_subscriptions")
      .delete()
      .in("id", staleIds);

    if (deleteError) {
      console.error("[WebPush] Failed to clean up stale subscriptions:", deleteError);
    } else {
      console.info(`[WebPush] Cleaned up ${staleIds.length} stale subscription(s)`);
    }
  }

  // Log summary of any unexpected failures
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`[WebPush] ${failures.length}/${results.length} sends failed`);
  }
}
