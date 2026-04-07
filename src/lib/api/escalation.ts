// ---------------------------------------------------------------------------
// OKrunit -- Approval Escalation Logic
// ---------------------------------------------------------------------------
// Handles escalation processing: computing next escalation times, resolving
// escalation targets to user IDs, and processing due escalations per org.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotifications } from "@/lib/notifications/orchestrator";
import { createInAppNotificationBulk } from "@/lib/notifications/in-app";
import { logAuditEvent } from "@/lib/api/audit";
import { captureError } from "@/lib/monitoring/capture";
import type {
  EscalationConfig,
  EscalationLevel,
  EscalationTarget,
  ApprovalRequest,
} from "@/lib/types/database";

/**
 * Calculate the next escalation level and timestamp.
 * Returns null if no more levels remain.
 *
 * delay_minutes is relative to request creation time (absolute timing),
 * not relative to the previous escalation.
 */
export function calculateNextEscalation(
  config: EscalationConfig,
  currentLevel: number,
  createdAt: Date,
): { nextLevel: number; nextEscalationAt: string } | null {
  if (!config.enabled || !config.levels || config.levels.length === 0) {
    return null;
  }

  // Find the next level after currentLevel
  const sorted = [...config.levels].sort((a, b) => a.level - b.level);
  const nextLevelConfig = sorted.find((l) => l.level > currentLevel);

  if (!nextLevelConfig) {
    return null; // No more escalation levels
  }

  const nextAt = new Date(
    createdAt.getTime() + nextLevelConfig.delay_minutes * 60 * 1000,
  );

  return {
    nextLevel: nextLevelConfig.level,
    nextEscalationAt: nextAt.toISOString(),
  };
}

/**
 * Resolve an escalation target to concrete user IDs.
 */
export async function resolveEscalationTargets(
  orgId: string,
  target: EscalationTarget,
  assignedApprovers: string[] | null,
): Promise<string[]> {
  const admin = createAdminClient();

  switch (target.type) {
    case "same_approvers":
      return assignedApprovers ?? [];

    case "org_admins": {
      const { data } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["admin", "owner"]);
      return (data ?? []).map((m) => m.user_id);
    }

    case "team": {
      const { data } = await admin
        .from("team_memberships")
        .select("user_id")
        .eq("team_id", target.team_id);
      return (data ?? []).map((m) => m.user_id);
    }

    case "users":
      return target.user_ids;

    default:
      return [];
  }
}

/**
 * Process all due escalations for a single organization.
 * Fire-and-forget per request. One failure never blocks others.
 */
export async function processEscalationsForOrg(
  orgId: string,
  config: EscalationConfig,
  now: Date,
): Promise<{ processed: number; errors: number }> {
  const admin = createAdminClient();
  let processed = 0;
  let errors = 0;

  // Find pending requests due for escalation
  const { data: requests } = await admin
    .from("approval_requests")
    .select(
      "id, title, description, priority, source, action_type, connection_id, assigned_approvers, assigned_team_id, escalation_level, created_at",
    )
    .eq("org_id", orgId)
    .eq("status", "pending")
    .not("next_escalation_at", "is", null)
    .lte("next_escalation_at", now.toISOString())
    .limit(100);

  if (!requests || requests.length === 0) {
    return { processed: 0, errors: 0 };
  }

  // Process each request independently
  const results = await Promise.allSettled(
    requests.map(async (request) => {
      const currentLevel = request.escalation_level ?? 0;

      // Find the config for the level we're about to fire
      const sorted = [...config.levels].sort((a, b) => a.level - b.level);
      const levelConfig = sorted.find((l) => l.level > currentLevel);

      if (!levelConfig) return; // No matching level. Shouldn't happen but be safe

      // Resolve target users
      const targetUserIds = await resolveEscalationTargets(
        orgId,
        levelConfig.target,
        request.assigned_approvers,
      );

      if (targetUserIds.length === 0) return; // No one to notify

      // Send notifications
      await dispatchNotifications({
        type: "approval.escalated",
        orgId,
        requestId: request.id,
        requestTitle: request.title,
        requestDescription: request.description,
        requestPriority: request.priority,
        connectionId: request.connection_id,
        source: request.source,
        actionType: request.action_type,
        targetUserIds,
        assignedApprovers: request.assigned_approvers,
        assignedTeamId: request.assigned_team_id,
        escalationLevel: levelConfig.level,
      });

      // Create in-app notifications for targets
      await createInAppNotificationBulk(targetUserIds, {
        orgId,
        category: "approval_awaiting",
        title: `Escalation (Level ${levelConfig.level}): "${request.title}"`,
        body: `This approval has been pending and requires attention.`,
        resourceType: "approval_request",
        resourceId: request.id,
      }).catch(() => {}); // Swallow individual failures

      // Log audit event
      logAuditEvent({
        orgId,
        action: "approval.escalated",
        resourceType: "approval_request",
        resourceId: request.id,
        details: {
          level: levelConfig.level,
          target_type: levelConfig.target.type,
          target_user_count: targetUserIds.length,
        },
      }).catch(() => {});

      // Calculate next escalation (if more levels exist)
      const next = calculateNextEscalation(
        config,
        levelConfig.level,
        new Date(request.created_at),
      );

      // Update the request
      await admin
        .from("approval_requests")
        .update({
          escalation_level: levelConfig.level,
          last_escalated_at: now.toISOString(),
          next_escalation_at: next?.nextEscalationAt ?? null,
        })
        .eq("id", request.id);

      processed++;
    }),
  );

  // Count errors
  for (const result of results) {
    if (result.status === "rejected") {
      errors++;
      captureError({
        error: result.reason,
        service: "Escalation",
        tags: { org_id: orgId },
      }).catch(() => {});
    }
  }

  return { processed, errors };
}
