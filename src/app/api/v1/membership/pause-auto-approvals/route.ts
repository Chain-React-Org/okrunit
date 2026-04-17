// ---------------------------------------------------------------------------
// OKrunit -- Toggle auto-approval pause for the current user's membership
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const schema = z.object({
  paused: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Session auth required", "SESSION_REQUIRED");
    }

    const body = await request.json();
    const { paused } = schema.parse(body);

    const admin = createAdminClient();

    const { error } = await admin
      .from("org_memberships")
      .update({ auto_approvals_paused: paused })
      .eq("user_id", auth.user.id)
      .eq("org_id", auth.orgId);

    if (error) {
      logger.error("[PauseAutoApprovals] Update failed:", error);
      throw new ApiError(500, "Failed to update auto-approval pause state");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: paused
        ? "membership.auto_approvals_paused"
        : "membership.auto_approvals_resumed",
      resourceType: "org_membership",
      resourceId: auth.user.id,
      ipAddress,
    });

    return NextResponse.json({ auto_approvals_paused: paused });
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
