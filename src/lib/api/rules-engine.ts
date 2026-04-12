// ---------------------------------------------------------------------------
// OKrunit -- Rule Evaluation Engine
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovalRule } from "@/lib/types/database";

// ---- Types ----------------------------------------------------------------

export interface RuleEvaluationInput {
  orgId: string;
  connectionId?: string;
  actionType?: string;
  priority: string;
  title: string;
  source?: string;
  riskLevel?: string;
  metadata?: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  matched: boolean;
  rule?: ApprovalRule;
  action?: "auto_approve" | "route";
  actionConfig?: Record<string, unknown>;
}

// ---- Public API -----------------------------------------------------------

/**
 * Evaluate all active rules for an org against an incoming approval request.
 * Rules are checked in priority_order (ascending). First match wins.
 */
export async function evaluateRules(
  input: RuleEvaluationInput,
): Promise<RuleEvaluationResult> {
  const admin = createAdminClient();

  // Fetch active rules for the org, ordered by priority_order.
  const { data: rules } = await admin
    .from("approval_rules")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("is_active", true)
    .order("priority_order", { ascending: true });

  if (!rules?.length) return { matched: false };

  for (const rule of rules) {
    // If rule is scoped to a specific connection, check it.
    if (rule.connection_id && rule.connection_id !== input.connectionId) {
      continue;
    }

    if (
      matchesConditions(rule.conditions as Record<string, unknown>, input)
    ) {
      return {
        matched: true,
        rule: rule as ApprovalRule,
        action: rule.action as "auto_approve" | "route",
        actionConfig: rule.action_config as Record<string, unknown>,
      };
    }
  }

  return { matched: false };
}

// ---- Internal Helpers -----------------------------------------------------

/**
 * Check if an input matches a rule's conditions.
 * All specified conditions must match (AND logic).
 *
 * Conditions are a JSON object with keys:
 * - priority_levels: string[] -- match if request priority is in this list
 * - action_types: string[] -- match if request action_type matches (glob: "deploy*")
 * - sources: string[] -- match if request source is in this list
 * - risk_levels: string[] -- match if risk level is in this list
 * - title_pattern: string -- regex pattern to match against title
 * - metadata_match: Record<string, unknown> -- shallow key-value match against metadata
 */
function matchesConditions(
  conditions: Record<string, unknown>,
  input: RuleEvaluationInput,
): boolean {
  // Check priority_levels.
  if (conditions.priority_levels) {
    const levels = conditions.priority_levels as string[];
    if (!levels.includes(input.priority)) return false;
  }

  // Check action_types (with glob support using simple wildcard matching).
  if (conditions.action_types) {
    const types = conditions.action_types as string[];
    if (input.actionType) {
      const matches = types.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp(
            "^" + pattern.replace(/\*/g, ".*") + "$",
          );
          return regex.test(input.actionType!);
        }
        return pattern === input.actionType;
      });
      if (!matches) return false;
    } else {
      // Rule requires action_type but request doesn't have one.
      return false;
    }
  }

  // Check sources.
  if (conditions.sources) {
    const sources = conditions.sources as string[];
    if (!input.source || !sources.includes(input.source)) return false;
  }

  // Check risk_levels.
  if (conditions.risk_levels) {
    const levels = conditions.risk_levels as string[];
    if (!input.riskLevel || !levels.includes(input.riskLevel)) return false;
  }

  // Check titles (exact match against a list of known titles).
  if (conditions.titles) {
    const titles = conditions.titles as string[];
    if (!titles.includes(input.title)) return false;
  }

  // Check title_pattern (regex) -- legacy, kept for backwards compatibility.
  if (conditions.title_pattern) {
    const pattern = new RegExp(conditions.title_pattern as string, "i");
    if (!pattern.test(input.title)) return false;
  }

  // Check metadata_match (shallow equality).
  if (conditions.metadata_match && input.metadata) {
    const match = conditions.metadata_match as Record<string, unknown>;
    for (const [key, value] of Object.entries(match)) {
      if (input.metadata[key] !== value) return false;
    }
  }

  return true;
}
