// ---------------------------------------------------------------------------
// OKrunit -- Bulk Approval Rules Engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { logAuditEvent } from "@/lib/api/audit";
import type { BulkApprovalRule } from "@/lib/types/database";

interface BulkExecutionResult {
  id: string;
  status: string;
  action_applied: string;
  success: boolean;
  error?: string;
}

interface BulkExecutionSummary {
  affected: number;
  results: BulkExecutionResult[];
}

/**
 * Check whether a single approval matches a bulk rule's filter criteria.
 */
function matchesFilters(
  approval: {
    status: string;
    priority: string;
    source: string | null;
    action_type: string;
    created_at: string;
  },
  rule: BulkApprovalRule,
): boolean {
  // Status filter
  if (rule.status_filter && approval.status !== rule.status_filter) {
    return false;
  }

  // Priority filter
  if (rule.priority_filter && rule.priority_filter.length > 0) {
    if (!rule.priority_filter.includes(approval.priority)) {
      return false;
    }
  }

  // Source filter
  if (rule.source_filter && rule.source_filter.length > 0) {
    if (!approval.source || !rule.source_filter.includes(approval.source)) {
      return false;
    }
  }

  // Action type filter
  if (rule.action_type_filter && rule.action_type_filter.length > 0) {
    if (!rule.action_type_filter.includes(approval.action_type)) {
      return false;
    }
  }

  // Age filter
  if (rule.older_than_minutes != null) {
    const createdAt = new Date(approval.created_at);
    const cutoff = new Date(Date.now() - rule.older_than_minutes * 60 * 1000);
    if (createdAt > cutoff) {
      return false;
    }
  }

  return true;
}

/**
 * Execute a bulk approval rule: query matching approvals and apply the action.
 *
 * Returns a summary of how many approvals were affected and individual results.
 */
export async function executeBulkRule(
  orgId: string,
  rule: BulkApprovalRule,
  executedBy: string,
  ipAddress: string,
): Promise<BulkExecutionSummary> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Build query for matching approvals
  let query = admin
    .from("approval_requests")
    .select("id, status, priority, source, action_type, created_at")
    .eq("org_id", orgId);

  // Apply status filter at the DB level
  if (rule.status_filter) {
    query = query.eq("status", rule.status_filter);
  }

  // Apply priority filter at the DB level if set
  if (rule.priority_filter && rule.priority_filter.length > 0) {
    query = query.in("priority", rule.priority_filter);
  }

  // Apply source filter at the DB level if set
  if (rule.source_filter && rule.source_filter.length > 0) {
    query = query.in("source", rule.source_filter);
  }

  // Apply action_type filter at the DB level if set
  if (rule.action_type_filter && rule.action_type_filter.length > 0) {
    query = query.in("action_type", rule.action_type_filter);
  }

  // Apply age filter at the DB level if set
  if (rule.older_than_minutes != null) {
    const cutoff = new Date(Date.now() - rule.older_than_minutes * 60 * 1000).toISOString();
    query = query.lt("created_at", cutoff);
  }

  // Limit to a reasonable batch size to avoid timeouts
  query = query.limit(500);

  const { data: approvals, error: fetchError } = await query;

  if (fetchError) {
    logger.error("[BulkRules] Failed to fetch matching approvals:", fetchError);
    return { affected: 0, results: [] };
  }

  if (!approvals || approvals.length === 0) {
    // Update last run stats even if nothing matched
    await admin
      .from("bulk_approval_rules")
      .update({ last_run_at: now, last_run_count: 0 })
      .eq("id", rule.id);

    return { affected: 0, results: [] };
  }

  // Double-check with in-memory filter (belt and suspenders for age filter edge cases)
  const matched = approvals.filter((a) => matchesFilters(a, rule));

  const results: BulkExecutionResult[] = [];

  for (const approval of matched) {
    try {
      if (rule.action === "approve" || rule.action === "reject") {
        const newStatus = rule.action === "approve" ? "approved" : "rejected";

        const { error: updateError } = await admin
          .from("approval_requests")
          .update({
            status: newStatus,
            decided_at: now,
            decision_source: "batch",
            decided_by: executedBy,
            ...(rule.action === "approve" ? { auto_approved: false } : {}),
          })
          .eq("id", approval.id)
          .eq("status", "pending"); // guard against races

        if (updateError) {
          results.push({
            id: approval.id,
            status: approval.status,
            action_applied: rule.action,
            success: false,
            error: updateError.message,
          });
          continue;
        }

        results.push({
          id: approval.id,
          status: newStatus,
          action_applied: rule.action,
          success: true,
        });
      } else if (rule.action === "archive") {
        const { error: archiveError } = await admin
          .from("approval_requests")
          .update({ archived_at: now })
          .eq("id", approval.id);

        if (archiveError) {
          results.push({
            id: approval.id,
            status: approval.status,
            action_applied: "archive",
            success: false,
            error: archiveError.message,
          });
          continue;
        }

        results.push({
          id: approval.id,
          status: approval.status,
          action_applied: "archive",
          success: true,
        });
      }
    } catch (err) {
      results.push({
        id: approval.id,
        status: approval.status,
        action_applied: rule.action,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  // Update rule run stats
  await admin
    .from("bulk_approval_rules")
    .update({ last_run_at: now, last_run_count: successCount })
    .eq("id", rule.id);

  // Audit log the bulk execution
  await logAuditEvent({
    orgId,
    userId: executedBy,
    action: "bulk_rule.executed",
    resourceType: "bulk_approval_rule",
    resourceId: rule.id,
    details: {
      rule_name: rule.name,
      action: rule.action,
      matched: matched.length,
      affected: successCount,
      failed: results.filter((r) => !r.success).length,
    },
    ipAddress,
  });

  return { affected: successCount, results };
}
