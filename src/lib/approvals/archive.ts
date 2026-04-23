// ---------------------------------------------------------------------------
// OKrunit -- Archive Permission Helper
// ---------------------------------------------------------------------------
// Single source of truth for "who is allowed to archive/unarchive a
// request?" — shared by the client UI (hide the button) and the batch
// archive endpoint (reject the call). Rule: creator of the request OR
// an org admin/owner. Approvers on the chain who aren't also creators
// or admins can't archive.
// ---------------------------------------------------------------------------

import type { ApprovalRequest } from "@/lib/types/database";

export function canArchiveApproval(
  approval: Pick<ApprovalRequest, "created_by">,
  currentUserId: string | undefined,
  userRole: string | undefined,
): boolean {
  if (!currentUserId) return false;
  if (userRole === "owner" || userRole === "admin") return true;

  const createdBy = approval.created_by as { user_id?: string } | null;
  return !!createdBy?.user_id && createdBy.user_id === currentUserId;
}
