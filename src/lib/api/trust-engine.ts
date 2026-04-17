// ---------------------------------------------------------------------------
// OKrunit -- Trust Engine: Auto-approve after N consecutive approvals
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Types ----------------------------------------------------------------

export interface TrustCheckResult {
  autoApprove: boolean;
  reason: string;
  counterId: string | null;
}

export interface TrustCounter {
  id: string;
  org_id: string;
  match_field: string;
  match_value: string;
  consecutive_approvals: number;
  total_approvals: number;
  total_rejections: number;
  last_decision: string | null;
  last_decision_at: string | null;
  auto_approve_threshold: number | null;
  auto_approve_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ApprovalMatchInput {
  action_type?: string | null;
  source?: string | null;
  title?: string;
  connection_id?: string | null;
}

// ---- Public API -----------------------------------------------------------

/**
 * Check if an incoming approval matches any trust counter that has reached
 * its auto-approve threshold. Returns the first matching active counter.
 */
export async function checkTrustThreshold(
  orgId: string,
  approval: ApprovalMatchInput,
): Promise<TrustCheckResult> {
  const admin = createAdminClient();

  // Fetch all active trust counters for this org.
  const { data: counters, error } = await admin
    .from("approval_trust_counters")
    .select("*")
    .eq("org_id", orgId)
    .eq("auto_approve_active", true);

  if (error || !counters?.length) {
    return { autoApprove: false, reason: "", counterId: null };
  }

  for (const counter of counters as TrustCounter[]) {
    if (matchesCounter(counter, approval)) {
      return {
        autoApprove: true,
        reason: `Trust threshold met: ${counter.consecutive_approvals} consecutive approvals on ${counter.match_field}="${counter.match_value}" (threshold: ${counter.auto_approve_threshold})`,
        counterId: counter.id,
      };
    }
  }

  return { autoApprove: false, reason: "", counterId: null };
}

/**
 * Update all matching trust counters after a decision is made.
 * On approve: increment consecutive_approvals and total_approvals.
 * On reject: reset consecutive_approvals to 0, increment total_rejections,
 * and deactivate auto_approve_active.
 *
 * This function never throws -- trust counter updates must not break the
 * decision flow.
 */
export async function updateTrustCounter(
  orgId: string,
  approval: ApprovalMatchInput,
  decision: "approved" | "rejected",
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Fetch all counters for this org (not just active ones).
    const { data: counters, error } = await admin
      .from("approval_trust_counters")
      .select("*")
      .eq("org_id", orgId);

    if (error || !counters?.length) return;

    const now = new Date().toISOString();

    for (const counter of counters as TrustCounter[]) {
      if (!matchesCounter(counter, approval)) continue;

      if (decision === "approved") {
        const newConsecutive = counter.consecutive_approvals + 1;
        const newTotal = counter.total_approvals + 1;
        const reachedThreshold =
          counter.auto_approve_threshold !== null &&
          newConsecutive >= counter.auto_approve_threshold;

        await admin
          .from("approval_trust_counters")
          .update({
            consecutive_approvals: newConsecutive,
            total_approvals: newTotal,
            last_decision: "approved",
            last_decision_at: now,
            auto_approve_active: reachedThreshold || counter.auto_approve_active,
            updated_at: now,
          })
          .eq("id", counter.id);
      } else {
        // Rejection resets the consecutive count and deactivates auto-approve.
        await admin
          .from("approval_trust_counters")
          .update({
            consecutive_approvals: 0,
            total_rejections: counter.total_rejections + 1,
            last_decision: "rejected",
            last_decision_at: now,
            auto_approve_active: false,
            updated_at: now,
          })
          .eq("id", counter.id);
      }
    }
  } catch (err) {
    logger.error("[TrustEngine] Failed to update trust counters:", err);
  }
}

/**
 * List all trust counters for an org.
 */
export async function getTrustCounters(
  orgId: string,
): Promise<TrustCounter[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("approval_trust_counters")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[TrustEngine] Failed to fetch trust counters:", error);
    throw error;
  }

  return (data ?? []) as TrustCounter[];
}

// ---- Internal Helpers -----------------------------------------------------

/**
 * Check if an approval matches a specific trust counter based on its
 * match_field and match_value.
 */
function matchesCounter(
  counter: TrustCounter,
  approval: ApprovalMatchInput,
): boolean {
  switch (counter.match_field) {
    case "action_type":
      return approval.action_type === counter.match_value;

    case "source":
      return approval.source === counter.match_value;

    case "title_pattern": {
      if (!approval.title) return false;
      try {
        const regex = new RegExp(counter.match_value, "i");
        return regex.test(approval.title);
      } catch {
        // Invalid regex in match_value -- treat as no match.
        return false;
      }
    }

    case "connection_id":
      return approval.connection_id === counter.match_value;

    default:
      return false;
  }
}
