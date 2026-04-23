// ---------------------------------------------------------------------------
// OKrunit -- Server-side permission checks for org memberships
// ---------------------------------------------------------------------------
// Keep permission checks in one place so the server never role-bypasses
// a permission by accident. There is no role-based escape hatch: if an
// owner has been revoked a permission, they lose the ability alongside
// anyone else.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/monitoring/logger";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

/**
 * Require that the current user has the `can_manage_flows` permission in
 * the given org. Throws ApiError(403) otherwise. Use from any handler
 * that mutates flow templates or rewrites the approver chain on a
 * pending request.
 */
export async function requireManageFlowsPermission(
  admin: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("org_memberships")
    .select("can_manage_flows")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "Failed to verify permissions");
  }
  if (!data?.can_manage_flows) {
    throw new ApiError(
      403,
      "You don't have permission to manage approval flows. Ask an org admin to grant you the Manage Flows permission.",
    );
  }
}

/**
 * Grant `can_manage_flows = true` to a user's membership if they don't
 * already have it. Used when a user brings a new integration online
 * (their inbound request auto-creates a flow) so they can configure the
 * thing they just wired up without having to ask an admin for rights.
 *
 * Best-effort: failures are logged but don't bubble. We never want this
 * to block an approval request from being created.
 */
export async function grantManageFlowsIfMissing(
  admin: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<void> {
  try {
    const { data: existing, error: readError } = await admin
      .from("org_memberships")
      .select("id, can_manage_flows")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (readError || !existing || existing.can_manage_flows) return;

    const { error: updateError } = await admin
      .from("org_memberships")
      .update({ can_manage_flows: true })
      .eq("id", existing.id);

    if (updateError) {
      logger.error("[Permissions] Failed to auto-grant can_manage_flows:", updateError);
      return;
    }

    // Invalidate cached member lists so the toggle flips in the UI
    // without a hard reload.
    revalidateTags(CacheTags.members(orgId), CacheTags.routes(orgId));
  } catch (err) {
    logger.error("[Permissions] Unexpected error auto-granting can_manage_flows:", err);
  }
}
