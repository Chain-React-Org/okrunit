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
