// ---------------------------------------------------------------------------
// OKrunit -- Archive Permission Helper
// ---------------------------------------------------------------------------
// Single source of truth for "who is allowed to archive/unarchive a
// request?" — shared by the client UI (hide the button) and the batch
// archive endpoint (silently drop disallowed IDs).
//
// Rule: allowed if any of
//   1. The caller is an org owner or admin, OR
//   2. The caller created the request, OR
//   3. The request is assigned to a team and the caller is a lead of
//      that team.
// Everyone else (plain members, approvers on the chain, etc.) is not
// allowed.
// ---------------------------------------------------------------------------

import type { ApprovalRequest } from "@/lib/types/database";

export function canArchiveApproval(
  approval: Pick<ApprovalRequest, "created_by" | "assigned_team_id">,
  currentUserId: string | undefined,
  userRole: string | undefined,
  leadTeamIds?: ReadonlySet<string>,
): boolean {
  if (!currentUserId) return false;
  if (userRole === "owner" || userRole === "admin") return true;

  const createdBy = approval.created_by as { user_id?: string } | null;
  if (createdBy?.user_id && createdBy.user_id === currentUserId) return true;

  if (
    approval.assigned_team_id &&
    leadTeamIds &&
    leadTeamIds.has(approval.assigned_team_id)
  ) {
    return true;
  }

  return false;
}
