// ---------------------------------------------------------------------------
// OKrunit -- Bulk Approval Rules API: GET, PATCH, DELETE (single rule)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { updateBulkRuleSchema } from "@/lib/api/validation";
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

// ---- GET /api/v1/bulk-rules/[id] ------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage bulk rules");
    }

    const admin = createAdminClient();

    const { data: rule, error } = await admin
      .from("bulk_approval_rules")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !rule) {
      throw new ApiError(404, "Bulk rule not found", "NOT_FOUND");
    }

    return NextResponse.json({ data: rule });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/bulk-rules/[id] ----------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage bulk rules");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    let body: z.infer<typeof updateBulkRuleSchema>;
    try {
      body = updateBulkRuleSchema.parse(await request.json());
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

    // Verify the rule exists and belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("bulk_approval_rules")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Bulk rule not found", "NOT_FOUND");
    }

    const { data: rule, error: updateError } = await admin
      .from("bulk_approval_rules")
      .update(body)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (updateError || !rule) {
      logger.error("[BulkRules] Failed to update rule:", updateError);
      throw new ApiError(500, "Failed to update bulk rule");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "bulk_rule.updated",
      resourceType: "bulk_approval_rule",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ data: rule });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/bulk-rules/[id] ---------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage bulk rules");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the rule exists and belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("bulk_approval_rules")
      .select("id, name")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Bulk rule not found", "NOT_FOUND");
    }

    const { error: deleteError } = await admin
      .from("bulk_approval_rules")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (deleteError) {
      logger.error("[BulkRules] Failed to delete rule:", deleteError);
      throw new ApiError(500, "Failed to delete bulk rule");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "bulk_rule.deleted",
      resourceType: "bulk_approval_rule",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
