// ---------------------------------------------------------------------------
// OKrunit -- Messaging Connections Loader
// ---------------------------------------------------------------------------
// Loads active messaging connections for an organization, used by the
// notification orchestrator to fan out to Slack, Discord, Teams, and Telegram.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { MessagingConnection } from "@/lib/types/database";

/**
 * Load all active messaging connections for an organization.
 *
 * Returns an array of `MessagingConnection` rows with `is_active = true`.
 * If loading fails, returns an empty array so the orchestrator can continue
 * delivering to other channels.
 */
export async function getOrgMessagingConnections(
  orgId: string,
): Promise<MessagingConnection[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("messaging_connections")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true);

  if (error) {
    logger.error(
      "[Messaging] Failed to load messaging connections:",
      error.message,
    );
    return [];
  }

  return (data as MessagingConnection[]) ?? [];
}
