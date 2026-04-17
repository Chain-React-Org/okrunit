// ---------------------------------------------------------------------------
// OKrunit -- Approval Webhooks API: GET (delivery history for an approval)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- GET /api/v1/approvals/[id]/webhooks ---------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Authenticate -- session only (dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access webhook delivery history",
        "SESSION_REQUIRED",
      );
    }

    const { id: approvalId } = await params;
    const orgId = auth.orgId;
    const admin = createAdminClient();

    // 2. Verify the approval exists and belongs to this org
    const { data: approval, error: approvalError } = await admin
      .from("approval_requests")
      .select("id, org_id")
      .eq("id", approvalId)
      .single();

    if (approvalError || !approval) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    if (approval.org_id !== orgId) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    // 3. Fetch all delivery attempts for this approval
    const { data: deliveries, error: queryError } = await admin
      .from("webhook_delivery_log")
      .select(
        `
        id,
        request_id,
        connection_id,
        url,
        method,
        request_headers,
        request_body,
        response_status,
        response_headers,
        response_body,
        duration_ms,
        attempt_number,
        success,
        error_message,
        created_at
      `,
      )
      .eq("request_id", approvalId)
      .order("created_at", { ascending: false });

    if (queryError) {
      logger.error("[Webhooks] Query failed:", queryError);
      throw new ApiError(500, "Failed to fetch webhook delivery history");
    }

    // 4. Compute summary
    const allDeliveries = deliveries ?? [];
    const totalAttempts = allDeliveries.length;
    const successCount = allDeliveries.filter((d) => d.success).length;
    const failureCount = totalAttempts - successCount;

    // Determine the latest delivery status
    const latestDelivery = allDeliveries.length > 0 ? allDeliveries[0] : null;
    const latestStatus = latestDelivery?.success ? "success" : "failed";

    return NextResponse.json({
      approval_id: approvalId,
      summary: {
        total_attempts: totalAttempts,
        success_count: successCount,
        failure_count: failureCount,
        latest_status: totalAttempts > 0 ? latestStatus : null,
        latest_attempt_at: latestDelivery?.created_at ?? null,
      },
      deliveries: allDeliveries,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
