// ---------------------------------------------------------------------------
// OKrunit -- Bulk Approval Rules API: Execute (manually trigger a rule)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeBulkRule } from "@/lib/api/bulk-rules";
import type { BulkApprovalRule } from "@/lib/types/database";

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- POST /api/v1/bulk-rules/[id]/execute ---------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can execute bulk rules");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Fetch the rule
    const { data: rule, error: fetchError } = await admin
      .from("bulk_approval_rules")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !rule) {
      throw new ApiError(404, "Bulk rule not found", "NOT_FOUND");
    }

    if (!rule.is_active) {
      throw new ApiError(
        400,
        "Cannot execute an inactive rule",
        "RULE_INACTIVE",
      );
    }

    // Check org emergency stop
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("emergency_stop_active")
      .eq("id", auth.orgId)
      .single();

    if (orgError || !org) {
      throw new ApiError(500, "Failed to fetch organization");
    }

    if (org.emergency_stop_active) {
      throw new ApiError(
        503,
        "Emergency stop is active. Bulk operations are disabled",
        "EMERGENCY_STOP",
      );
    }

    const ipAddress = getIpAddress(request);

    // Execute the rule
    const result = await executeBulkRule(
      auth.orgId,
      rule as BulkApprovalRule,
      auth.user.id,
      ipAddress,
    );

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
