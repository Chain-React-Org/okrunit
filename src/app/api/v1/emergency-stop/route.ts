// ---------------------------------------------------------------------------
// OKrunit -- Emergency Stop API: POST (toggle)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { deliverCallback } from "@/lib/api/callbacks";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkIpRateLimit, rateLimitResponse, WRITE_RATE_LIMIT } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation -----------------------------------------------------------

const emergencyStopSchema = z.object({
  active: z.boolean(),
});

// ---- POST /api/v1/emergency-stop ------------------------------------------

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`emergency-stop:${ip}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can toggle the emergency stop",
        "SESSION_REQUIRED",
      );
    }

    // 2. Must be admin or owner role
    if (auth.membership.role !== "admin" && auth.membership.role !== "owner") {
      throw new ApiError(
        403,
        "Only admins and owners can toggle the emergency stop",
        "INSUFFICIENT_ROLE",
      );
    }

    // 3. Parse and validate body
    const body = await request.json();
    const validated = emergencyStopSchema.parse(body);

    const admin = createAdminClient();
    const orgId = auth.orgId;

    // 4. Update organization emergency stop state
    const { error: updateError } = await admin
      .from("organizations")
      .update({
        emergency_stop_active: validated.active,
        emergency_stop_activated_at: validated.active
          ? new Date().toISOString()
          : null,
        emergency_stop_activated_by: validated.active ? auth.user.id : null,
      })
      .eq("id", orgId);

    if (updateError) {
      logger.error("[EmergencyStop] Update failed:", updateError);
      throw new ApiError(500, "Failed to update emergency stop state");
    }

    // 5. If activating: cancel all pending approvals
    let cancelledCount = 0;

    if (validated.active) {
      // Fetch pending approvals (need callback info for delivery)
      const { data: pendingApprovals, error: fetchError } = await admin
        .from("approval_requests")
        .select("id, connection_id, callback_url, callback_headers, title, priority, metadata")
        .eq("org_id", orgId)
        .eq("status", "pending");

      if (fetchError) {
        logger.error("[EmergencyStop] Failed to fetch pending approvals:", fetchError);
      }

      if (pendingApprovals && pendingApprovals.length > 0) {
        // Batch update all pending approvals to cancelled
        const { error: cancelError } = await admin
          .from("approval_requests")
          .update({
            status: "cancelled",
            decision_source: "emergency",
          })
          .eq("org_id", orgId)
          .eq("status", "pending");

        if (cancelError) {
          logger.error("[EmergencyStop] Failed to cancel pending approvals:", cancelError);
        } else {
          cancelledCount = pendingApprovals.length;
        }

        // Fire-and-forget callback delivery for each cancelled approval
        for (const approval of pendingApprovals) {
          if (approval.callback_url) {
            deliverCallback({
              requestId: approval.id,
              connectionId: approval.connection_id,
              callbackUrl: approval.callback_url,
              callbackHeaders:
                (approval.callback_headers as Record<string, string>) ??
                undefined,
              payload: {
                id: approval.id,
                status: "cancelled",
                decided_by: null,
                decided_at: null,
                decision_comment: "Emergency stop activated",
                title: approval.title,
                priority: approval.priority,
                metadata: approval.metadata,
              },
            });
          }
        }
      }
    }

    // 6. Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId,
      userId: auth.user.id,
      action: validated.active
        ? "emergency_stop.activated"
        : "emergency_stop.deactivated",
      resourceType: "organization",
      resourceId: orgId,
      details: {
        cancelled_count: cancelledCount,
      },
      ipAddress,
    });

    // 7. Return result
    return NextResponse.json({
      emergency_stop_active: validated.active,
      cancelled_count: cancelledCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
