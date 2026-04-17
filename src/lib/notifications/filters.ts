// ---------------------------------------------------------------------------
// OKrunit -- Notification Filters
// ---------------------------------------------------------------------------
//
// shouldNotify()            -- per-user gate: quiet hours + priority threshold
// getOrgNotificationSettings() -- bulk-load settings for every org member
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { NotificationSettings } from "@/lib/types/database";
import { PRIORITY_ORDER } from "@/lib/constants";

// ---------------------------------------------------------------------------
// shouldNotify
// ---------------------------------------------------------------------------

/**
 * Determine whether a user should receive a notification right now.
 *
 * Two checks are applied in order:
 *  1. **Priority threshold** -- if the event priority is below the user's
 *     configured `minimum_priority`, the notification is suppressed.
 *  2. **Quiet hours** -- if the current wall-clock time in the user's
 *     timezone falls within their quiet-hours window, the notification is
 *     suppressed. Overnight windows (e.g. 22:00 - 07:00) are supported.
 *
 * Returns `true` when the notification should be delivered.
 */
export function shouldNotify(
  settings: NotificationSettings,
  priority: string,
): boolean {
  // -- Priority threshold ----------------------------------------------------
  const eventPriorityOrder =
    PRIORITY_ORDER[priority as keyof typeof PRIORITY_ORDER] ?? 0;
  const minPriorityOrder =
    PRIORITY_ORDER[settings.minimum_priority as keyof typeof PRIORITY_ORDER] ?? 0;

  if (eventPriorityOrder < minPriorityOrder) {
    return false;
  }

  // -- Quiet hours -----------------------------------------------------------
  if (
    settings.quiet_hours_enabled &&
    settings.quiet_hours_start &&
    settings.quiet_hours_end
  ) {
    const tz = settings.quiet_hours_timezone || "UTC";
    const now = new Date();

    // Format the current time as HH:mm in the user's timezone so we can do a
    // simple string comparison against the stored start/end values.
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(now); // e.g. "14:30"

    const start = settings.quiet_hours_start; // e.g. "22:00"
    const end = settings.quiet_hours_end; // e.g. "07:00"

    // Handle same-day windows (e.g. 09:00 - 17:00) and overnight windows
    // (e.g. 22:00 - 07:00) separately.
    if (start <= end) {
      // Same-day window: suppress when start <= now < end
      if (currentTime >= start && currentTime < end) {
        return false;
      }
    } else {
      // Overnight window: suppress when now >= start OR now < end
      if (currentTime >= start || currentTime < end) {
        return false;
      }
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// getOrgNotificationSettings
// ---------------------------------------------------------------------------

/**
 * Load notification settings for every member of an organisation.
 *
 * Returns an array of `{ userId, email, settings }` tuples. If a user has
 * not configured their notification preferences, `settings` will be `null`
 * and the caller should apply sensible defaults.
 */
export async function getOrgNotificationSettings(
  orgId: string,
): Promise<
  Array<{
    userId: string;
    email: string;
    settings: NotificationSettings | null;
  }>
> {
  const admin = createAdminClient();

  // 1. Fetch org members via org_memberships (org_id was removed from
  //    user_profiles in the multi-org migration).
  const { data: memberships, error: membershipsError } = await admin
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", orgId);

  if (membershipsError) {
    logger.error(
      "[Notifications] Failed to load org memberships:",
      membershipsError.message,
    );
    return [];
  }

  if (!memberships?.length) {
    return [];
  }

  const memberUserIds = memberships.map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await admin
    .from("user_profiles")
    .select("id, email")
    .in("id", memberUserIds);

  if (profilesError) {
    logger.error(
      "[Notifications] Failed to load user profiles:",
      profilesError.message,
    );
    return [];
  }

  if (!profiles?.length) {
    return [];
  }

  // 2. Bulk-load notification settings for all discovered users.
  const userIds = profiles.map((p) => p.id);
  const { data: settingsRows, error: settingsError } = await admin
    .from("notification_settings")
    .select("*")
    .in("user_id", userIds);

  if (settingsError) {
    logger.error(
      "[Notifications] Failed to load notification settings:",
      settingsError.message,
    );
    // Continue with null settings -- the orchestrator will apply defaults.
  }

  const settingsMap = new Map(
    settingsRows?.map((s) => [s.user_id, s]) ?? [],
  );

  return profiles.map((p) => ({
    userId: p.id,
    email: p.email,
    settings: (settingsMap.get(p.id) as NotificationSettings) ?? null,
  }));
}
