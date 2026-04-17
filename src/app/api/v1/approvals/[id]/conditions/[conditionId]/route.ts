// ---------------------------------------------------------------------------
// OKrunit -- Single Condition API: PATCH (update status) + DELETE (remove)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { updateConditionSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Helpers --------------------------------------------------------------

async function fetchConditionWithApproval(
  admin: ReturnType<typeof createAdminClient>,
  conditionId: string,
  requestId: string,
  orgId: string,
) {
  // Verify the approval belongs to the org
  const { data: approval, error: approvalError } = await admin
    .from("approval_requests")
    .select("id, org_id, status")
    .eq("id", requestId)
    .eq("org_id", orgId)
    .single();

  if (approvalError || !approval) {
    throw new ApiError(404, "Approval request not found", "NOT_FOUND");
  }

  // Fetch the condition
  const { data: condition, error: conditionError } = await admin
    .from("approval_conditions")
    .select("*")
    .eq("id", conditionId)
    .eq("request_id", requestId)
    .single();

  if (conditionError || !condition) {
    throw new ApiError(404, "Condition not found", "CONDITION_NOT_FOUND");
  }

  return { approval, condition };
}

/**
 * After a condition status change, re-evaluate whether all conditions for
 * the request are met and update the parent approval.
 */
async function recalculateConditionsMet(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
): Promise<boolean> {
  const { data: allConditions } = await admin
    .from("approval_conditions")
    .select("status")
    .eq("request_id", requestId);

  if (!allConditions || allConditions.length === 0) {
    await admin
      .from("approval_requests")
      .update({ conditions_met: true })
      .eq("id", requestId);
    return true;
  }

  const allMet = allConditions.every(
    (c: { status: string }) => c.status === "met",
  );

  await admin
    .from("approval_requests")
    .update({ conditions_met: allMet })
    .eq("id", requestId);

  return allMet;
}

// ---- PATCH /api/v1/approvals/[id]/conditions/[conditionId] ----------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; conditionId: string }> },
) {
  try {
    const { id, conditionId } = await params;

    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can update conditions",
        "SESSION_REQUIRED",
      );
    }

    const admin = createAdminClient();

    // 2. Fetch condition and approval
    const { condition } = await fetchConditionWithApproval(
      admin,
      conditionId,
      id,
      auth.orgId,
    );

    // 3. Validate body
    const body = await request.json();
    const validated = updateConditionSchema.parse(body);

    // 4. Update the condition
    const { data: updated, error: updateError } = await admin
      .from("approval_conditions")
      .update({
        status: validated.status,
        checked_at: new Date().toISOString(),
        check_result: validated.check_result ?? {
          manual_update: true,
          updated_by: auth.user.id,
        },
      })
      .eq("id", conditionId)
      .select("*")
      .single();

    if (updateError || !updated) {
      logger.error("[Conditions] Update failed:", updateError);
      throw new ApiError(500, "Failed to update condition");
    }

    // 5. Recalculate conditions_met
    await recalculateConditionsMet(admin, id);

    // 6. Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: `condition.${validated.status}`,
      resourceType: "approval_condition",
      resourceId: conditionId,
      details: {
        request_id: id,
        name: condition.name,
        previous_status: condition.status,
        new_status: validated.status,
      },
      ipAddress,
    });

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

// ---- DELETE /api/v1/approvals/[id]/conditions/[conditionId] ---------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; conditionId: string }> },
) {
  try {
    const { id, conditionId } = await params;

    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can remove conditions",
        "SESSION_REQUIRED",
      );
    }

    const admin = createAdminClient();

    // 2. Fetch condition and approval
    const { condition } = await fetchConditionWithApproval(
      admin,
      conditionId,
      id,
      auth.orgId,
    );

    // 3. Delete the condition
    const { error: deleteError } = await admin
      .from("approval_conditions")
      .delete()
      .eq("id", conditionId);

    if (deleteError) {
      logger.error("[Conditions] Delete failed:", deleteError);
      throw new ApiError(500, "Failed to delete condition");
    }

    // 4. Recalculate conditions_met (removing a condition might make all remaining conditions met)
    await recalculateConditionsMet(admin, id);

    // 5. Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "condition.deleted",
      resourceType: "approval_condition",
      resourceId: conditionId,
      details: {
        request_id: id,
        name: condition.name,
        check_type: condition.check_type,
      },
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
