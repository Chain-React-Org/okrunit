// ---------------------------------------------------------------------------
// OKrunit -- Approval Templates API: GET, PATCH, DELETE (single template)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { updateTemplateSchema } from "@/lib/api/validation";
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

// ---- GET /api/v1/templates/[id] -------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Session users can view; API key / OAuth callers can also look up
    // templates when creating approvals, so allow all auth types.
    const admin = createAdminClient();

    const { data: template, error } = await admin
      .from("approval_templates")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !template) {
      throw new ApiError(404, "Template not found", "NOT_FOUND");
    }

    return NextResponse.json({ data: template });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/templates/[id] -----------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage templates");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    let body: z.infer<typeof updateTemplateSchema>;
    try {
      body = updateTemplateSchema.parse(await request.json());
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

    // Verify the template exists and belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("approval_templates")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Template not found", "NOT_FOUND");
    }

    const { data: template, error: updateError } = await admin
      .from("approval_templates")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (updateError || !template) {
      logger.error("[Templates] Failed to update template:", updateError);
      throw new ApiError(500, "Failed to update template");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "template.updated",
      resourceType: "approval_template",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ data: template });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/templates/[id] ----------------------------------------
// Soft-delete: sets is_active = false rather than removing the row.

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage templates");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the template exists and belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("approval_templates")
      .select("id, name")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Template not found", "NOT_FOUND");
    }

    // Soft-delete: mark as inactive
    const { error: updateError } = await admin
      .from("approval_templates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (updateError) {
      logger.error("[Templates] Failed to deactivate template:", updateError);
      throw new ApiError(500, "Failed to delete template");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "template.deleted",
      resourceType: "approval_template",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
