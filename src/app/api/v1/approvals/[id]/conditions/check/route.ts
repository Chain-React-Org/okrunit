// ---------------------------------------------------------------------------
// OKrunit -- Condition Check API: POST (trigger re-check of all conditions)
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { checkConditions } from "@/lib/api/conditions";
import { deliverCallback } from "@/lib/api/callbacks";
import { createAdminClient } from "@/lib/supabase/admin";
import { titleCaseName } from "@/lib/format-name";

// ---- POST /api/v1/approvals/[id]/conditions/check ------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate
    const auth = await authenticateRequest(request);
    const admin = createAdminClient();

    // 2. Fetch approval
    const { data: approval, error: approvalError } = await admin
      .from("approval_requests")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (approvalError || !approval) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    // 3. Check all conditions
    const result = await checkConditions(id);

    // 4. Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.type === "session" ? auth.user.id : undefined,
      action: "condition.check_all",
      resourceType: "approval_request",
      resourceId: id,
      details: {
        all_met: result.allMet,
        condition_count: result.conditions.length,
        conditions_summary: result.conditions.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
        })),
      },
      ipAddress,
    });

    // 5. If all conditions are now met and approval is approved, deliver callback
    if (result.allMet && approval.status === "approved" && approval.callback_url) {
      // Also check that execution is not scheduled for later
      if (
        approval.execution_status === "immediate" ||
        approval.execution_status === "executed"
      ) {
        let decidedByName: string | null = null;
        if (approval.decided_by) {
          const { data: profile } = await admin
            .from("user_profiles")
            .select("full_name, email")
            .eq("id", approval.decided_by)
            .single();
          decidedByName = titleCaseName(profile?.full_name) || profile?.email || null;
        }

        after(
          deliverCallback({
            requestId: id,
            connectionId: approval.connection_id,
            callbackUrl: approval.callback_url,
            callbackHeaders:
              (approval.callback_headers as Record<string, string>) ?? undefined,
            payload: {
              id: approval.id,
              status: approval.status,
              decided_by: approval.decided_by,
              decided_by_name: decidedByName,
              decided_at: approval.decided_at,
              decision_comment: approval.decision_comment,
              title: approval.title,
              priority: approval.priority,
              metadata: approval.metadata,
              conditions_met: true,
            },
          })
        );
      }
    }

    return NextResponse.json({
      all_met: result.allMet,
      conditions: result.conditions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
