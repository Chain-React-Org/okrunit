// ---------------------------------------------------------------------------
// OKrunit -- Approval Flows API: GET (single) + PATCH (update) + DELETE
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { requireManageFlowsPermission } from "@/lib/api/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation -----------------------------------------------------------

const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

const updateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  source_url: z.string().url().max(2000).nullable().optional(),
  default_priority: priorityEnum.nullable().optional(),
  default_expiration_hours: z.number().int().min(1).max(720).nullable().optional(),
  default_required_approvals: z.number().int().min(1).max(10).nullable().optional(),
  default_action_type: z.string().max(100).nullable().optional(),
  assigned_team_id: z.string().uuid().nullable().optional(),
  assigned_position_id: z.string().uuid().nullable().optional(),
  assigned_approvers: z.array(z.string().uuid()).max(10).nullable().optional(),
  approver_mode: z.enum(["any", "designated", "role_based"]).optional(),
  required_role: z.enum(["owner", "admin", "member"]).nullable().optional(),
  is_sequential: z.boolean().optional(),
  apply_for_next: z.number().int().min(1).max(10000).nullable().optional(),
});

// ---- Helpers --------------------------------------------------------------

async function fetchFlow(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  orgId: string,
) {
  const { data: flow, error } = await admin
    .from("approval_flows")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !flow) {
    throw new ApiError(404, "Approval flow not found", "NOT_FOUND");
  }

  return flow;
}

// ---- GET /api/v1/flows/[id] -----------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type === "api_key") {
      throw new ApiError(403, "Session or OAuth auth required", "SESSION_REQUIRED");
    }

    const admin = createAdminClient();
    const flow = await fetchFlow(admin, id, auth.orgId);

    return NextResponse.json(flow);
  } catch (error) {
    return errorResponse(error);
  }
}

// ---- PATCH /api/v1/flows/[id] ---------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type === "api_key") {
      throw new ApiError(403, "Session or OAuth auth required", "SESSION_REQUIRED");
    }

    const admin = createAdminClient();
    const actingUserId =
      auth.type === "session" ? auth.user.id : auth.type === "oauth" ? auth.userId : null;
    if (!actingUserId) {
      throw new ApiError(403, "Session or OAuth auth required", "SESSION_REQUIRED");
    }
    await requireManageFlowsPermission(admin, actingUserId, auth.orgId);
    await fetchFlow(admin, id, auth.orgId);

    const body = await request.json();
    const validated = updateFlowSchema.parse(body);

    // Mark as configured when any settings are provided
    const updatePayload: Record<string, unknown> = {
      ...validated,
      is_configured: true,
    };

    const { data: updated, error } = await admin
      .from("approval_flows")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (error || !updated) {
      logger.error("[Flows] Update failed:", error);
      throw new ApiError(500, "Failed to update approval flow");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.type === "session" ? auth.user.id : auth.type === "oauth" ? auth.userId : undefined,
      action: "flow.updated",
      resourceType: "approval_flow",
      resourceId: id,
      details: validated,
      ipAddress,
    });

    revalidateTags(CacheTags.routes(auth.orgId));

    return NextResponse.json(updated);
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

// ---- DELETE /api/v1/flows/[id] --------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type === "api_key") {
      throw new ApiError(403, "Session or OAuth auth required", "SESSION_REQUIRED");
    }

    const admin = createAdminClient();
    const actingUserId =
      auth.type === "session" ? auth.user.id : auth.type === "oauth" ? auth.userId : null;
    if (!actingUserId) {
      throw new ApiError(403, "Session or OAuth auth required", "SESSION_REQUIRED");
    }
    await requireManageFlowsPermission(admin, actingUserId, auth.orgId);
    await fetchFlow(admin, id, auth.orgId);

    const { error } = await admin
      .from("approval_flows")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (error) {
      logger.error("[Flows] Delete failed:", error);
      throw new ApiError(500, "Failed to delete approval flow");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.type === "session" ? auth.user.id : auth.type === "oauth" ? auth.userId : undefined,
      action: "flow.deleted",
      resourceType: "approval_flow",
      resourceId: id,
      ipAddress,
    });

    revalidateTags(CacheTags.routes(auth.orgId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
