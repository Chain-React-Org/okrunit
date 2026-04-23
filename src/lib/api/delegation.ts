// ---------------------------------------------------------------------------
// OKrunit -- Approval Delegation
// ---------------------------------------------------------------------------
//
// Allows users to delegate their approval responsibility to another team
// member for a specified time period. Delegations are org-scoped and
// time-bounded.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovalDelegation } from "@/lib/types/database";

// Accept the standard RFC 4122 UUID shape. Used to gate values that
// get interpolated into PostgREST `.or()` filter strings below.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- Public API -----------------------------------------------------------

/**
 * Check if a user has delegated their approvals to someone else.
 * Returns the active delegation record or null.
 */
export async function getActiveDelegation(
  orgId: string,
  userId: string,
): Promise<ApprovalDelegation | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data } = await admin
    .from("approval_delegations")
    .select("*")
    .eq("org_id", orgId)
    .eq("delegator_id", userId)
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ApprovalDelegation) ?? null;
}

/**
 * Given a list of approver user IDs, resolve any active delegations.
 * Returns a map of { originalApproverId: delegateId }.
 *
 * Only returns entries where a delegation is active -- approvers without
 * delegations are not included in the returned map.
 */
export async function resolveDelegates(
  orgId: string,
  approverIds: string[],
): Promise<Map<string, string>> {
  if (approverIds.length === 0) return new Map();

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: delegations } = await admin
    .from("approval_delegations")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .in("delegator_id", approverIds);

  const delegateMap = new Map<string, string>();

  if (delegations) {
    for (const d of delegations) {
      // Only take the first (most recent) delegation per delegator
      if (!delegateMap.has(d.delegator_id)) {
        delegateMap.set(d.delegator_id, d.delegate_id);
      }
    }
  }

  return delegateMap;
}

/**
 * Find the delegation record where this user is acting as a delegate
 * for one of the assigned approvers.
 */
export async function findDelegationForDelegate(
  orgId: string,
  delegateUserId: string,
  assignedApprovers: string[],
): Promise<{ delegatorId: string; delegationId: string } | null> {
  if (assignedApprovers.length === 0) return null;

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: delegations } = await admin
    .from("approval_delegations")
    .select("*")
    .eq("org_id", orgId)
    .eq("delegate_id", delegateUserId)
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .in("delegator_id", assignedApprovers);

  if (delegations && delegations.length > 0) {
    return {
      delegatorId: delegations[0].delegator_id,
      delegationId: delegations[0].id,
    };
  }

  return null;
}

/**
 * Create a new delegation.
 */
export async function createDelegation(
  orgId: string,
  delegatorId: string,
  delegateId: string,
  reason: string | null,
  startsAt: string,
  endsAt: string,
): Promise<ApprovalDelegation> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("approval_delegations")
    .insert({
      org_id: orgId,
      delegator_id: delegatorId,
      delegate_id: delegateId,
      reason,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    // Handle unique constraint violation
    if (error?.code === "23505") {
      throw new DelegationError(
        "An active delegation already exists for this delegate",
        "DUPLICATE_DELEGATION",
      );
    }
    throw new DelegationError(
      "Failed to create delegation",
      "CREATE_FAILED",
    );
  }

  return data as ApprovalDelegation;
}

/**
 * Cancel (deactivate) a delegation early.
 */
export async function cancelDelegation(
  orgId: string,
  delegationId: string,
): Promise<ApprovalDelegation> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("approval_delegations")
    .update({ is_active: false })
    .eq("id", delegationId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    throw new DelegationError(
      "Delegation not found or already cancelled",
      "NOT_FOUND",
    );
  }

  return data as ApprovalDelegation;
}

/**
 * List all delegations for a user (both as delegator and delegate).
 */
export async function listDelegations(
  orgId: string,
  userId: string,
): Promise<ApprovalDelegation[]> {
  const admin = createAdminClient();

  // Validate UUIDs before interpolating into a PostgREST filter string
  // so a malformed caller can't inject additional clauses.
  if (!UUID_REGEX.test(orgId) || !UUID_REGEX.test(userId)) {
    throw new DelegationError(
      "Invalid org or user id",
      "INVALID_ID",
    );
  }

  const { data, error } = await admin
    .from("approval_delegations")
    .select("*")
    .eq("org_id", orgId)
    .or(`delegator_id.eq.${userId},delegate_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DelegationError(
      "Failed to list delegations",
      "LIST_FAILED",
    );
  }

  return (data ?? []) as ApprovalDelegation[];
}

// ---- Error Class ----------------------------------------------------------

export class DelegationError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DelegationError";
    this.code = code;
  }
}
