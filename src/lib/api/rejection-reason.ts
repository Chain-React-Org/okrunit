// ---------------------------------------------------------------------------
// OKrunit -- Decision Comment Policy Helpers
// ---------------------------------------------------------------------------
//
// Shared logic for determining whether a decision comment prompt should be
// shown and whether a rejection reason is required. Used by all messaging
// platform interaction handlers (Telegram, Discord, Slack, Teams).
// ---------------------------------------------------------------------------

import type { RejectionReasonPolicy } from "@/lib/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Result of checking the decision comment policy for a given approval.
 */
export interface DecisionCommentPolicy {
  /** Whether the reason prompt should be shown at all (false = apply immediately). */
  showPrompt: boolean;
  /** Whether a rejection reason is required and cannot be skipped. */
  reasonRequired: boolean;
}

/**
 * Determine the decision comment policy for a given approval request.
 *
 * This is the main function all messaging handlers should call. It returns:
 * - `showPrompt`: whether to show a reason/comment prompt before applying.
 *   This is `false` only when the org has `skip_decision_comment` enabled AND
 *   the rejection reason is not required for this specific action.
 * - `reasonRequired`: whether the reason is mandatory (cannot be skipped).
 *
 * When `reasonRequired` is true, `showPrompt` is always true regardless of
 * the org's `skip_decision_comment` setting.
 */
export async function getDecisionCommentPolicy(
  orgId: string,
  decision: "approve" | "reject",
  approval: {
    require_rejection_reason: boolean;
    priority: string;
  },
): Promise<DecisionCommentPolicy> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("rejection_reason_policy, skip_decision_comment")
    .eq("id", orgId)
    .single();

  const policy: RejectionReasonPolicy =
    (org?.rejection_reason_policy as RejectionReasonPolicy) ?? "optional";
  const skipComment = org?.skip_decision_comment ?? false;

  // Check if rejection reason is required for this specific request.
  let reasonRequired = false;
  if (decision === "reject") {
    if (approval.require_rejection_reason) {
      reasonRequired = true;
    } else if (policy === "required") {
      reasonRequired = true;
    } else if (
      policy === "required_high_critical" &&
      (approval.priority === "high" || approval.priority === "critical")
    ) {
      reasonRequired = true;
    }
  }

  // If reason is required, always show the prompt regardless of org setting.
  // Otherwise, show the prompt unless the org has opted to skip it.
  const showPrompt = reasonRequired || !skipComment;

  return { showPrompt, reasonRequired };
}

/**
 * Check whether a rejection reason is required for a given approval request.
 *
 * Returns `true` if the user must provide a reason and cannot skip.
 *
 * @deprecated Use `getDecisionCommentPolicy` instead for new code.
 */
export async function isRejectionReasonRequired(
  orgId: string,
  approval: {
    require_rejection_reason: boolean;
    priority: string;
  },
): Promise<boolean> {
  const { reasonRequired } = await getDecisionCommentPolicy(orgId, "reject", approval);
  return reasonRequired;
}
