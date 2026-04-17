// ---------------------------------------------------------------------------
// OKrunit -- In-App Notification Helpers
// ---------------------------------------------------------------------------
// Server-side helpers for creating in-app notifications. These are called
// from API routes when events happen that should notify a user.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { InAppNotificationInsert, NotificationCategory } from "@/lib/types/database";

interface CreateNotificationParams {
  userId: string;
  orgId: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  actorId?: string;
  actorName?: string;
  resourceType?: string;
  resourceId?: string;
  iconUrl?: string;
}

/**
 * Create a single in-app notification for a user.
 * Fire-and-forget. Errors are logged but not thrown.
 */
export async function createInAppNotification(params: CreateNotificationParams): Promise<void> {
  const admin = createAdminClient();

  const row: InAppNotificationInsert = {
    user_id: params.userId,
    org_id: params.orgId,
    category: params.category,
    title: params.title,
    body: params.body ?? null,
    actor_id: params.actorId ?? null,
    actor_name: params.actorName ?? null,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    icon_url: params.iconUrl ?? null,
  };

  const { error } = await admin.from("in_app_notifications").insert(row);
  if (error) {
    logger.error("[Notifications] Failed to create in-app notification:", error);
  }
}

/**
 * Create the same notification for multiple users at once.
 */
export async function createInAppNotificationBulk(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">,
): Promise<void> {
  if (userIds.length === 0) return;

  const admin = createAdminClient();

  const rows: InAppNotificationInsert[] = userIds.map((userId) => ({
    user_id: userId,
    org_id: params.orgId,
    category: params.category,
    title: params.title,
    body: params.body ?? null,
    actor_id: params.actorId ?? null,
    actor_name: params.actorName ?? null,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    icon_url: params.iconUrl ?? null,
  }));

  const { error } = await admin.from("in_app_notifications").insert(rows);
  if (error) {
    logger.error("[Notifications] Failed to create bulk in-app notifications:", error);
  }
}
