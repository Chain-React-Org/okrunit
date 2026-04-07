// ---------------------------------------------------------------------------
// OKrunit -- Smart Defaults
// Sensible out-of-the-box configuration for new organizations and users.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import type { SlaConfig, RejectionReasonPolicy } from "@/lib/types/database";

export interface SmartDefaults {
  timezone: string;
  notification: {
    email_enabled: boolean;
    push_enabled: boolean;
    quiet_hours_enabled: boolean;
    minimum_priority: "low" | "medium" | "high" | "critical";
  };
  sla: SlaConfig;
  rejection_reason_policy: RejectionReasonPolicy;
}

/**
 * Returns sensible defaults for a new org/user.
 * Timezone should be detected client-side via Intl.DateTimeFormat().resolvedOptions().timeZone
 * and passed through; falls back to "America/New_York".
 */
export function getSmartDefaults(timezone?: string): SmartDefaults {
  return {
    timezone: timezone ?? "America/New_York",
    notification: {
      email_enabled: true,
      push_enabled: true,
      quiet_hours_enabled: false,
      minimum_priority: "low",
    },
    sla: {
      critical: 15,
      high: 60,
      medium: null,
      low: null,
    },
    rejection_reason_policy: "optional",
  };
}

/**
 * Apply smart defaults to a newly-created organization.
 * Called after org creation (e.g., during signup or onboarding).
 */
export async function applySmartDefaults(orgId: string): Promise<void> {
  const defaults = getSmartDefaults();
  const admin = createAdminClient();

  await admin
    .from("organizations")
    .update({
      sla_config: defaults.sla,
      rejection_reason_policy: defaults.rejection_reason_policy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);
}

/**
 * Apply default notification settings for a new user.
 */
export async function applyUserNotificationDefaults(
  userId: string,
  timezone?: string,
): Promise<void> {
  const defaults = getSmartDefaults(timezone);
  const admin = createAdminClient();

  // Upsert notification settings - only if they don't already exist
  const { data: existing } = await admin
    .from("notification_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await admin.from("notification_settings").insert({
      user_id: userId,
      email_enabled: defaults.notification.email_enabled,
      push_enabled: defaults.notification.push_enabled,
      quiet_hours_enabled: defaults.notification.quiet_hours_enabled,
      quiet_hours_timezone: defaults.timezone,
      minimum_priority: defaults.notification.minimum_priority,
      skip_approval_confirmation: false,
      dashboard_layout: "cards" as const,
    });
  }
}
