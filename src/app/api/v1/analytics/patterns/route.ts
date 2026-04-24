// ---------------------------------------------------------------------------
// OKrunit -- Approval Pattern Detection API
// ---------------------------------------------------------------------------
// Analyzes historical approval data to suggest auto-approval rules
// or routing optimizations based on observed patterns.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { canUseFeature } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";

interface PatternSuggestion {
  type: "auto_approve" | "route";
  match_field: string;
  match_value: string;
  consecutive_approvals: number;
  total_approvals: number;
  total_rejections: number;
  approval_rate: number;
  description: string;
  confidence: "high" | "medium" | "low";
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can access patterns", "SESSION_REQUIRED");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const orgId = auth.orgId;

    const featureCheck = await canUseFeature(orgId, "analytics");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Upgrade required for analytics", "PLAN_LIMIT_EXCEEDED");
    }

    const admin = createAdminClient();

    // Fetch recent decided approvals (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: approvals } = await admin
      .from("approval_requests")
      .select("action_type, source, status, connection_id")
      .eq("org_id", orgId)
      .in("status", ["approved", "rejected"])
      .gte("created_at", ninetyDaysAgo.toISOString());

    if (!approvals || approvals.length === 0) {
      return NextResponse.json({ suggestions: [], message: "Not enough data yet. Patterns will appear after more approvals." });
    }

    // Fetch existing trust counters to exclude already-configured patterns
    const { data: existingCounters } = await admin
      .from("approval_trust_counters")
      .select("match_field, match_value")
      .eq("org_id", orgId);

    const existingSet = new Set(
      (existingCounters ?? []).map((c) => `${c.match_field}:${c.match_value}`),
    );

    // Analyze patterns by action_type
    const actionTypeCounts = new Map<string, { approved: number; rejected: number }>();
    const sourceCounts = new Map<string, { approved: number; rejected: number }>();

    for (const a of approvals) {
      if (a.action_type) {
        const existing = actionTypeCounts.get(a.action_type) ?? { approved: 0, rejected: 0 };
        if (a.status === "approved") existing.approved++;
        else existing.rejected++;
        actionTypeCounts.set(a.action_type, existing);
      }

      if (a.source) {
        const existing = sourceCounts.get(a.source) ?? { approved: 0, rejected: 0 };
        if (a.status === "approved") existing.approved++;
        else existing.rejected++;
        sourceCounts.set(a.source, existing);
      }
    }

    const suggestions: PatternSuggestion[] = [];

    // Suggest auto-approve for action types with high approval rates
    for (const [actionType, counts] of actionTypeCounts) {
      const total = counts.approved + counts.rejected;
      if (total < 5) continue; // Need at least 5 decisions
      if (existingSet.has(`action_type:${actionType}`)) continue;

      const rate = Math.round((counts.approved / total) * 100);

      if (rate >= 90 && counts.approved >= 10) {
        suggestions.push({
          type: "auto_approve",
          match_field: "action_type",
          match_value: actionType,
          consecutive_approvals: counts.approved,
          total_approvals: counts.approved,
          total_rejections: counts.rejected,
          approval_rate: rate,
          description: `"${actionType}" requests are approved ${rate}% of the time (${counts.approved}/${total}). Consider auto-approving.`,
          confidence: rate >= 98 ? "high" : rate >= 95 ? "medium" : "low",
        });
      }
    }

    // Suggest auto-approve for sources with high approval rates
    for (const [source, counts] of sourceCounts) {
      const total = counts.approved + counts.rejected;
      if (total < 5) continue;
      if (existingSet.has(`source:${source}`)) continue;

      const rate = Math.round((counts.approved / total) * 100);

      if (rate >= 90 && counts.approved >= 10) {
        suggestions.push({
          type: "auto_approve",
          match_field: "source",
          match_value: source,
          consecutive_approvals: counts.approved,
          total_approvals: counts.approved,
          total_rejections: counts.rejected,
          approval_rate: rate,
          description: `Requests from "${source}" are approved ${rate}% of the time (${counts.approved}/${total}). Consider auto-approving.`,
          confidence: rate >= 98 ? "high" : rate >= 95 ? "medium" : "low",
        });
      }
    }

    // Sort by confidence then approval rate
    suggestions.sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 };
      if (confOrder[a.confidence] !== confOrder[b.confidence]) {
        return confOrder[a.confidence] - confOrder[b.confidence];
      }
      return b.approval_rate - a.approval_rate;
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    return errorResponse(error);
  }
}
