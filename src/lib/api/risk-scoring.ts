// ---------------------------------------------------------------------------
// OKrunit -- Risk Scoring Engine
// ---------------------------------------------------------------------------
//
// Automatically assesses risk for approval requests based on multiple signals.
// Called during POST /api/v1/approvals after validation, before insert.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

// ---- Types ----------------------------------------------------------------

export interface RiskScore {
  score: number; // 0-100
  level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
}

export interface RiskFactor {
  name: string;
  score: number;
  reason: string;
}

// ---- Constants ------------------------------------------------------------

const PRIORITY_WEIGHTS: Record<string, number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 80,
};

const DESTRUCTIVE_KEYWORDS = ["delete", "drop", "remove", "destroy"];

const HIGH_FREQUENCY_THRESHOLD = 5;

// ---- Public API -----------------------------------------------------------

/**
 * Calculate a risk score for an incoming approval request.
 *
 * Factors considered:
 *  - Priority weight (base score)
 *  - Destructive action type keywords (+20)
 *  - Time of day outside business hours (+15)
 *  - Weekend requests (+10)
 *  - First-time action_type for the org (+15)
 *  - High frequency from the same source in the last hour (+10)
 *  - Missing description (+5)
 *  - No callback URL (-5)
 */
export async function calculateRiskScore(
  approval: {
    priority: string;
    action_type?: string | null;
    description?: string | null;
    callback_url?: string | null;
    source?: string | null;
  },
  orgId: string,
): Promise<RiskScore> {
  const factors: RiskFactor[] = [];

  // 1. Priority weight (always applied)
  const priorityScore = PRIORITY_WEIGHTS[approval.priority] ?? 25;
  factors.push({
    name: "priority_weight",
    score: priorityScore,
    reason: `Priority "${approval.priority}" base score`,
  });

  // 2. Destructive action type
  if (approval.action_type) {
    const actionLower = approval.action_type.toLowerCase();
    const isDestructive = DESTRUCTIVE_KEYWORDS.some((kw) =>
      actionLower.includes(kw),
    );
    if (isDestructive) {
      factors.push({
        name: "destructive_action",
        score: 20,
        reason: `Action type "${approval.action_type}" contains destructive keyword`,
      });
    }
  }

  // 3. Time of day (outside business hours: before 8am or after 8pm UTC)
  const now = new Date();
  const hour = now.getUTCHours();
  if (hour < 8 || hour >= 20) {
    factors.push({
      name: "outside_business_hours",
      score: 15,
      reason: `Request submitted at ${hour}:00 UTC (outside 8am-8pm)`,
    });
  }

  // 4. Weekend
  const dayOfWeek = now.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    factors.push({
      name: "weekend",
      score: 10,
      reason: "Request submitted on a weekend",
    });
  }

  // 5. First-time action_type + 6. High frequency (run DB checks in parallel)
  const admin = createAdminClient();

  const dbChecks = await Promise.allSettled([
    checkFirstTimeActionType(admin, orgId, approval.action_type),
    checkHighFrequency(admin, orgId, approval.source),
  ]);

  if (dbChecks[0].status === "fulfilled" && dbChecks[0].value) {
    factors.push(dbChecks[0].value);
  }
  if (dbChecks[1].status === "fulfilled" && dbChecks[1].value) {
    factors.push(dbChecks[1].value);
  }

  // 7. Missing description
  if (!approval.description || approval.description.trim().length === 0) {
    factors.push({
      name: "missing_description",
      score: 5,
      reason: "No description provided",
    });
  }

  // 8. No callback URL (reduces urgency)
  if (!approval.callback_url) {
    factors.push({
      name: "no_callback",
      score: -5,
      reason: "No callback URL, no automation waiting",
    });
  }

  // Calculate final score (clamped to 0-100)
  const rawScore = factors.reduce((sum, f) => sum + f.score, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  // Determine level
  const level = scoreToLevel(score);

  return { score, level, factors };
}

// ---- Internal Helpers -----------------------------------------------------

function scoreToLevel(
  score: number,
): "low" | "medium" | "high" | "critical" {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

/**
 * Check if this action_type has ever been seen before for the org.
 */
async function checkFirstTimeActionType(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  actionType: string | null | undefined,
): Promise<RiskFactor | null> {
  if (!actionType) return null;

  const { count } = await admin
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("action_type", actionType);

  if ((count ?? 0) === 0) {
    return {
      name: "first_time_action_type",
      score: 15,
      reason: `Action type "${actionType}" has never been seen before`,
    };
  }

  return null;
}

/**
 * Check if there have been more than 5 requests in the last hour from the
 * same source.
 */
async function checkHighFrequency(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  source: string | null | undefined,
): Promise<RiskFactor | null> {
  if (!source) return null;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await admin
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("source", source)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) > HIGH_FREQUENCY_THRESHOLD) {
    return {
      name: "high_frequency",
      score: 10,
      reason: `${count} requests from source "${source}" in the last hour`,
    };
  }

  return null;
}
