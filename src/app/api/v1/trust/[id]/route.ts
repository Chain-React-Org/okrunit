// ---------------------------------------------------------------------------
// OKrunit -- Trust Counters API: Update + Delete (single counter)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { updateTrustCounterSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- GET /api/v1/trust/[id] -----------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage trust counters");
    }

    const admin = createAdminClient();

    const { data: counter, error } = await admin
      .from("approval_trust_counters")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !counter) {
      throw new ApiError(404, "Trust counter not found", "NOT_FOUND");
    }

    return NextResponse.json({ data: counter });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/trust/[id] ---------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage trust counters.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage trust counters");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof updateTrustCounterSchema>;
    try {
      body = updateTrustCounterSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    const admin = createAdminClient();

    // Verify the counter exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("approval_trust_counters")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Trust counter not found", "NOT_FOUND");
    }

    // Build the update payload, including updated_at.
    const updatePayload: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // If threshold is being lowered and current consecutive_approvals already
    // meets it, activate auto-approve. If threshold is raised, deactivate.
    if (body.auto_approve_threshold !== undefined) {
      const { data: current } = await admin
        .from("approval_trust_counters")
        .select("consecutive_approvals")
        .eq("id", id)
        .single();

      if (current && body.auto_approve_threshold !== null) {
        updatePayload.auto_approve_active =
          current.consecutive_approvals >= body.auto_approve_threshold;
      } else if (body.auto_approve_threshold === null) {
        updatePayload.auto_approve_active = false;
      }
    }

    const { data: counter, error: updateError } = await admin
      .from("approval_trust_counters")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (updateError || !counter) {
      logger.error("[Trust] Failed to update trust counter:", updateError);
      throw new ApiError(500, "Failed to update trust counter");
    }

    // Audit the update.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "trust_counter.updated",
      resourceType: "approval_trust_counter",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ data: counter });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/trust/[id] --------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage trust counters.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage trust counters");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the counter exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("approval_trust_counters")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Trust counter not found", "NOT_FOUND");
    }

    // Delete the counter.
    const { error: deleteError } = await admin
      .from("approval_trust_counters")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (deleteError) {
      logger.error("[Trust] Failed to delete trust counter:", deleteError);
      throw new ApiError(500, "Failed to delete trust counter");
    }

    // Audit the deletion.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "trust_counter.deleted",
      resourceType: "approval_trust_counter",
      resourceId: id,
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
