// ---------------------------------------------------------------------------
// OKrunit -- Bottleneck Detection
// ---------------------------------------------------------------------------
//
// Detect users with excessive pending approval load and suggest redistribution.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { titleCaseName } from "@/lib/format-name";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserLoad {
  user_id: string;
  user_name: string | null;
  user_email: string;
  pending_count: number;
}

export interface BottleneckAlert {
  user_id: string;
  user_name: string | null;
  user_email: string;
  pending_count: number;
  threshold: number;
  excess: number;
}

export interface RedistributionSuggestion {
  overloaded_user: {
    user_id: string;
    user_name: string | null;
    pending_count: number;
  };
  suggested_targets: Array<{
    user_id: string;
    user_name: string | null;
    current_load: number;
    capacity: number;
  }>;
}

export interface BottleneckReport {
  load_distribution: UserLoad[];
  overloaded_users: BottleneckAlert[];
  redistribution_suggestions: RedistributionSuggestion[];
  threshold: number;
  alert_enabled: boolean;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect users who have more pending approvals assigned to them than the
 * org's bottleneck threshold. Returns alerts for each overloaded user.
 */
export async function detectBottlenecks(orgId: string): Promise<{
  alerts: BottleneckAlert[];
  threshold: number;
  alertEnabled: boolean;
}> {
  const admin = createAdminClient();

  // Fetch org settings
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("bottleneck_threshold, bottleneck_alert_enabled")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    logger.error("[Bottleneck] Failed to fetch org settings:", orgError);
    return { alerts: [], threshold: 10, alertEnabled: true };
  }

  const threshold = org.bottleneck_threshold ?? 10;
  const alertEnabled = org.bottleneck_alert_enabled ?? true;

  if (!alertEnabled) {
    return { alerts: [], threshold, alertEnabled };
  }

  const distribution = await getApprovalLoadDistribution(orgId);

  const alerts: BottleneckAlert[] = distribution
    .filter((u) => u.pending_count > threshold)
    .map((u) => ({
      user_id: u.user_id,
      user_name: u.user_name,
      user_email: u.user_email,
      pending_count: u.pending_count,
      threshold,
      excess: u.pending_count - threshold,
    }));

  return { alerts, threshold, alertEnabled };
}

// ---------------------------------------------------------------------------
// Load Distribution
// ---------------------------------------------------------------------------

/**
 * Return the pending approval count per user for the whole org.
 * Only counts approvals where the user is in the assigned_approvers array.
 */
export async function getApprovalLoadDistribution(
  orgId: string,
): Promise<UserLoad[]> {
  const admin = createAdminClient();

  // Fetch all pending approvals with assigned_approvers
  const { data: pendingApprovals, error } = await admin
    .from("approval_requests")
    .select("assigned_approvers")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .not("assigned_approvers", "is", null);

  if (error) {
    logger.error("[Bottleneck] Failed to fetch pending approvals:", error);
    return [];
  }

  // Count pending approvals per user
  const userCounts = new Map<string, number>();
  for (const approval of pendingApprovals ?? []) {
    const approvers: string[] = approval.assigned_approvers ?? [];
    for (const userId of approvers) {
      userCounts.set(userId, (userCounts.get(userId) ?? 0) + 1);
    }
  }

  if (userCounts.size === 0) return [];

  // Fetch user profiles for display names
  const userIds = Array.from(userCounts.keys());
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; email: string }) => [
      p.id,
      { name: titleCaseName(p.full_name), email: p.email },
    ]),
  );

  const result: UserLoad[] = [];
  for (const [userId, count] of userCounts) {
    const profile = profileMap.get(userId);
    result.push({
      user_id: userId,
      user_name: profile?.name ?? null,
      user_email: profile?.email ?? "unknown",
      pending_count: count,
    });
  }

  // Sort by pending count descending
  result.sort((a, b) => b.pending_count - a.pending_count);
  return result;
}

// ---------------------------------------------------------------------------
// Redistribution Suggestions
// ---------------------------------------------------------------------------

/**
 * Find overloaded users and suggest redistribution to users with lower load.
 * Only considers org members with can_approve = true.
 */
export async function suggestRedistribution(
  orgId: string,
): Promise<RedistributionSuggestion[]> {
  const admin = createAdminClient();

  // Fetch org threshold
  const { data: org } = await admin
    .from("organizations")
    .select("bottleneck_threshold")
    .eq("id", orgId)
    .single();

  const threshold = org?.bottleneck_threshold ?? 10;

  // Get current load distribution
  const distribution = await getApprovalLoadDistribution(orgId);

  // Get all users who can approve in this org
  const { data: approverMemberships } = await admin
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("can_approve", true);

  const allApproverIds = new Set(
    (approverMemberships ?? []).map((m: { user_id: string }) => m.user_id),
  );

  // Build load map (include users with 0 load)
  const loadMap = new Map(
    distribution.map((u) => [u.user_id, u]),
  );

  // Fetch profiles for all approvers (including those not in distribution)
  const missingIds = Array.from(allApproverIds).filter((id) => !loadMap.has(id));
  if (missingIds.length > 0) {
    const { data: missingProfiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", missingIds);

    for (const p of missingProfiles ?? []) {
      loadMap.set(p.id, {
        user_id: p.id,
        user_name: p.full_name,
        user_email: p.email,
        pending_count: 0,
      });
    }
  }

  const overloaded = distribution.filter((u) => u.pending_count > threshold);
  if (overloaded.length === 0) return [];

  // Find potential targets (users below threshold who can approve)
  const suggestions: RedistributionSuggestion[] = [];

  for (const user of overloaded) {
    const targets = Array.from(loadMap.values())
      .filter(
        (u) =>
          u.user_id !== user.user_id &&
          allApproverIds.has(u.user_id) &&
          u.pending_count < threshold,
      )
      .sort((a, b) => a.pending_count - b.pending_count)
      .slice(0, 5) // top 5 suggestions
      .map((u) => ({
        user_id: u.user_id,
        user_name: u.user_name,
        current_load: u.pending_count,
        capacity: threshold - u.pending_count,
      }));

    suggestions.push({
      overloaded_user: {
        user_id: user.user_id,
        user_name: user.user_name,
        pending_count: user.pending_count,
      },
      suggested_targets: targets,
    });
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Bottleneck Check (for use after approval creation)
// ---------------------------------------------------------------------------

/**
 * Check if any of the given user IDs now exceeds the org's bottleneck
 * threshold. Returns the list of user IDs that are over the threshold.
 *
 * This is a lightweight check meant to be called after assigning approvals.
 */
export async function checkBottleneckThreshold(
  orgId: string,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const admin = createAdminClient();

  // Fetch org settings
  const { data: org } = await admin
    .from("organizations")
    .select("bottleneck_threshold, bottleneck_alert_enabled")
    .eq("id", orgId)
    .single();

  if (!org || !org.bottleneck_alert_enabled) return [];

  const threshold = org.bottleneck_threshold ?? 10;

  // Count pending approvals per user
  const { data: pendingApprovals } = await admin
    .from("approval_requests")
    .select("assigned_approvers")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .not("assigned_approvers", "is", null);

  const userCounts = new Map<string, number>();
  for (const approval of pendingApprovals ?? []) {
    const approvers: string[] = approval.assigned_approvers ?? [];
    for (const userId of approvers) {
      if (userIds.includes(userId)) {
        userCounts.set(userId, (userCounts.get(userId) ?? 0) + 1);
      }
    }
  }

  return userIds.filter((uid) => (userCounts.get(uid) ?? 0) > threshold);
}
