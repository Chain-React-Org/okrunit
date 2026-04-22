// ---------------------------------------------------------------------------
// OKrunit -- "Currently Responsible" Helper
// ---------------------------------------------------------------------------
// Returns a display string describing who currently needs to act on a request.
// ---------------------------------------------------------------------------

import type { ApprovalRequest, UserProfile } from "@/lib/types/database";

interface Team {
  id: string;
  name: string;
}

/**
 * Determine who is currently responsible for acting on a pending approval.
 * Returns null if the request is not pending.
 */
export function getCurrentlyResponsible(
  approval: ApprovalRequest,
  userProfiles: Map<string, UserProfile>,
  teams?: Map<string, Team>,
): string | null {
  if (approval.status !== "pending") return null;

  // Sequential chain: the next approver in line
  if (approval.is_sequential && approval.assigned_approvers?.length) {
    const nextIdx = approval.current_approvals;
    const nextUserId = approval.assigned_approvers[nextIdx];
    if (nextUserId) {
      const profile = userProfiles.get(nextUserId);
      return profile?.full_name || profile?.email || "Next approver";
    }
  }

  // Parallel with assigned approvers
  if (approval.assigned_approvers?.length) {
    if (approval.assigned_approvers.length === 1) {
      const profile = userProfiles.get(approval.assigned_approvers[0]);
      return profile?.full_name || profile?.email || "Assigned approver";
    }
    return `${approval.assigned_approvers.length} approvers`;
  }

  // Team-assigned
  if (approval.assigned_team_id && teams) {
    const team = teams.get(approval.assigned_team_id);
    if (team) return team.name;
  }

  // Role-based
  if (approval.required_role) {
    const label = approval.required_role.charAt(0).toUpperCase() + approval.required_role.slice(1);
    return `${label}+`;
  }

  return "Any approver";
}

/**
 * Return true when the current user is allowed to decide on this request
 * right now.
 *
 * Rules:
 *  - Request must be pending (not finalized or expired).
 *  - User must have org-level approval permission (`canApprove`).
 *  - Users can never decide on requests they themselves created (self-approval).
 *  - If the request has specific assigned approvers, the user must be in the
 *    list. For sequential flows, the user must be the next in line.
 *  - For any-approver mode, the org-level permission is enough.
 */
export function canDecideOnApproval(
  approval: Pick<
    ApprovalRequest,
    | "status"
    | "is_log"
    | "assigned_approvers"
    | "is_sequential"
    | "current_approvals"
    | "created_by"
  >,
  currentUserId: string | undefined,
  canApprove: boolean,
  /** User IDs this user is an active delegate for. The user counts as
   * eligible if any of their delegators is in assigned_approvers (or is the
   * next-in-line for a sequential flow). */
  delegatorIds?: ReadonlySet<string>,
): boolean {
  if (!currentUserId) return false;
  if (!canApprove) return false;
  if (approval.status !== "pending") return false;
  if (approval.is_log) return false;

  const createdBy = approval.created_by as { user_id?: string } | null;
  const isSelfCreated = !!createdBy?.user_id && createdBy.user_id === currentUserId;
  const hasAssigned = !!approval.assigned_approvers?.length;
  const isExplicitlyInChain =
    hasAssigned && approval.assigned_approvers!.includes(currentUserId);

  // Block self-approval in the default "any approver" case, where a
  // creator acting as approver would be trivial self-approval. When a
  // creator is explicitly listed on the chain (e.g., added themselves
  // via Configure Flow Rules), respect that intent — the audit log still
  // captures exactly who approved.
  if (isSelfCreated && !isExplicitlyInChain) return false;

  if (!hasAssigned) return true;

  // Set of IDs that "count as" the current user: themselves + anyone who has
  // delegated their approval authority to them for this org.
  const eligibleIds = new Set<string>([currentUserId]);
  if (delegatorIds) for (const id of delegatorIds) eligibleIds.add(id);

  if (approval.is_sequential) {
    const nextUserId = approval.assigned_approvers![approval.current_approvals];
    return !!nextUserId && eligibleIds.has(nextUserId);
  }
  return approval.assigned_approvers!.some((uid: string) => eligibleIds.has(uid));
}
