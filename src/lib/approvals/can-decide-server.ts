// ---------------------------------------------------------------------------
// OKrunit -- Server-side approval decision gate
// ---------------------------------------------------------------------------
// The single source of truth for "can this user decide on this request right
// now?". The Slack / Teams / Discord / Telegram inbound handlers all consult
// this before writing a decision so messaging-app clicks respect the same
// permission rules the web app enforces: assigned_approvers membership,
// sequential turn order, self-approval block, four-eyes principle, and
// active delegation.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFourEyes } from "@/lib/api/four-eyes";
import { findDelegationForDelegate } from "@/lib/api/delegation";
import type { ApprovalRequest, Organization } from "@/lib/types/database";

export type DecideEligibility =
  | { ok: true; delegatedFrom: string | null }
  | {
      ok: false;
      code:
        | "NOT_PENDING"
        | "EXPIRED"
        | "SELF_APPROVAL_BLOCKED"
        | "NOT_ASSIGNED_APPROVER"
        | "NOT_YOUR_TURN"
        | "INSUFFICIENT_ROLE"
        | "FOUR_EYES_BLOCKED"
        | "ALREADY_VOTED";
      reason: string;
      waitingOn?: string; // display name of the person we're actually waiting on
    };

/**
 * Check whether the given OKrunit user is allowed to decide on this approval
 * right now. Runs every permission rule in the same order as the web respond
 * endpoint so inbound messaging clicks cannot bypass.
 */
export async function canUserDecideServerSide(
  admin: SupabaseClient,
  params: {
    approval: Pick<
      ApprovalRequest,
      | "id"
      | "org_id"
      | "status"
      | "expires_at"
      | "assigned_approvers"
      | "is_sequential"
      | "current_approvals"
      | "required_approvals"
      | "required_role"
      | "created_by"
      | "action_type"
      | "priority"
    >;
    actorUserId: string;
    /** Pre-fetched org (for four-eyes config). Optional; fetched if omitted. */
    org?: Pick<Organization, "four_eyes_config">;
    /** Pre-fetched membership (for role checks). Optional; fetched if omitted. */
    membershipRole?: string;
  },
): Promise<DecideEligibility> {
  const { approval, actorUserId } = params;

  // 1. Status checks.
  if (approval.status !== "pending") {
    return {
      ok: false,
      code: "NOT_PENDING",
      reason: `This request has already been ${approval.status}.`,
    };
  }
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    return {
      ok: false,
      code: "EXPIRED",
      reason: "This request has expired.",
    };
  }

  // 2. Self-approval block (applies in the default "any approver" case; when
  //    the creator was explicitly added to a sequential chain, we respect the
  //    explicit intent).
  const createdBy = approval.created_by as { user_id?: string } | null;
  const isSelfCreated =
    !!createdBy?.user_id && createdBy.user_id === actorUserId;
  const hasAssigned = !!approval.assigned_approvers?.length;
  const isExplicitlyInChain =
    hasAssigned && approval.assigned_approvers!.includes(actorUserId);

  if (isSelfCreated && !isExplicitlyInChain) {
    return {
      ok: false,
      code: "SELF_APPROVAL_BLOCKED",
      reason: "You cannot decide on a request you created yourself.",
    };
  }

  // 3. Double-vote guard: on multi-approver flows, a user cannot vote twice.
  if (approval.required_approvals > 1 || approval.is_sequential) {
    const { data: existingVote } = await admin
      .from("approval_votes")
      .select("id")
      .eq("request_id", approval.id)
      .eq("user_id", actorUserId)
      .maybeSingle();
    if (existingVote) {
      return {
        ok: false,
        code: "ALREADY_VOTED",
        reason: "You have already voted on this request.",
      };
    }
  }

  // 4. Assigned-approver check (with delegation fallback).
  let delegatedFrom: string | null = null;
  if (hasAssigned) {
    if (!approval.assigned_approvers!.includes(actorUserId)) {
      const deleg = await findDelegationForDelegate(
        approval.org_id,
        actorUserId,
        approval.assigned_approvers!,
      );
      if (!deleg) {
        return {
          ok: false,
          code: "NOT_ASSIGNED_APPROVER",
          reason: "You are not an assigned approver for this request.",
        };
      }
      delegatedFrom = deleg.delegatorId;
    }

    // 5. Sequential turn check. Whoever the next-in-line is, must be the
    //    actor OR one of the actor's delegators.
    if (approval.is_sequential) {
      const { data: priorVotes } = await admin
        .from("approval_votes")
        .select("user_id")
        .eq("request_id", approval.id);
      const voted = new Set(
        (priorVotes ?? []).map((v: { user_id: string }) => v.user_id),
      );
      const nextApprover = approval.assigned_approvers!.find(
        (uid) => !voted.has(uid),
      );
      const eligibleIds = new Set<string>([actorUserId]);
      if (delegatedFrom) eligibleIds.add(delegatedFrom);
      if (nextApprover && !eligibleIds.has(nextApprover)) {
        const { data: nextProfile } = await admin
          .from("user_profiles")
          .select("full_name, email")
          .eq("id", nextApprover)
          .maybeSingle();
        const waitingOn =
          nextProfile?.full_name ?? nextProfile?.email ?? "another approver";
        return {
          ok: false,
          code: "NOT_YOUR_TURN",
          reason: `It's not your turn yet. Currently waiting on ${waitingOn}.`,
          waitingOn,
        };
      }
    }
  }

  // 6. Role hierarchy check, if the flow requires it.
  if (approval.required_role) {
    const roleLevel: Record<string, number> = {
      member: 0,
      approver: 1,
      admin: 2,
      owner: 3,
    };
    let actorRole = params.membershipRole;
    if (!actorRole) {
      const { data: mem } = await admin
        .from("org_memberships")
        .select("role")
        .eq("user_id", actorUserId)
        .eq("org_id", approval.org_id)
        .maybeSingle();
      actorRole = mem?.role;
    }
    if (
      !actorRole ||
      (roleLevel[actorRole] ?? -1) < (roleLevel[approval.required_role] ?? 0)
    ) {
      return {
        ok: false,
        code: "INSUFFICIENT_ROLE",
        reason: `This request requires approval from someone with the "${approval.required_role}" role or higher.`,
      };
    }
  }

  // 7. Four-eyes check (same gate the web respond endpoint uses).
  let orgForFourEyes = params.org;
  if (!orgForFourEyes) {
    const { data } = await admin
      .from("organizations")
      .select("four_eyes_config")
      .eq("id", approval.org_id)
      .maybeSingle();
    orgForFourEyes = data ?? undefined;
  }
  if (orgForFourEyes) {
    const fourEyes = checkFourEyes(
      orgForFourEyes,
      approval,
      actorUserId,
    );
    if (!fourEyes.allowed) {
      return {
        ok: false,
        code: "FOUR_EYES_BLOCKED",
        reason: fourEyes.reason ?? "Self-approval blocked by four-eyes policy.",
      };
    }
  }

  return { ok: true, delegatedFrom };
}

// ---------------------------------------------------------------------------
// Messaging user identity resolver
// ---------------------------------------------------------------------------

/**
 * Look up the OKrunit user linked to a messaging platform user id for the
 * given org. Returns null when the user hasn't been linked yet — in which
 * case the inbound handler should reply with a "link your account" message
 * instead of writing a decision.
 */
export async function resolveMessagingUser(
  admin: SupabaseClient,
  params: {
    orgId: string;
    platform: "slack" | "teams" | "discord" | "telegram";
    externalUserId: string;
  },
): Promise<{ userId: string; role: string } | null> {
  const { data: identity } = await admin
    .from("messaging_user_identities")
    .select("user_id")
    .eq("org_id", params.orgId)
    .eq("platform", params.platform)
    .eq("external_user_id", params.externalUserId)
    .maybeSingle();

  if (!identity) return null;

  const { data: membership } = await admin
    .from("org_memberships")
    .select("role, can_approve")
    .eq("org_id", params.orgId)
    .eq("user_id", identity.user_id)
    .maybeSingle();

  if (!membership || !membership.can_approve) return null;
  return { userId: identity.user_id, role: membership.role };
}
