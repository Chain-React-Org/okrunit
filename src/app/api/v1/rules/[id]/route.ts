// ---------------------------------------------------------------------------
// OKrunit -- Approval Rules API: Update + Delete (single rule)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createRuleSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Partial update schema (all fields optional) --------------------------

const updateRuleSchema = createRuleSchema.partial();

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- PATCH /api/v1/rules/[id] ---------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage rules.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage rules");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof updateRuleSchema>;
    try {
      body = updateRuleSchema.parse(await request.json());
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

    // Verify the rule exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("approval_rules")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Rule not found");
    }

    // Apply the partial update.
    const { data: rule, error: updateError } = await admin
      .from("approval_rules")
      .update(body)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (updateError || !rule) {
      console.error("[Rules] Failed to update rule:", updateError);
      throw new ApiError(500, "Failed to update rule");
    }

    // Audit the update.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "rule.updated",
      resourceType: "approval_rule",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.rules(auth.orgId));

    return NextResponse.json({ data: rule });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/rules/[id] --------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage rules.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage rules");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the rule exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("approval_rules")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Rule not found");
    }

    // Delete the rule.
    const { error: deleteError } = await admin
      .from("approval_rules")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (deleteError) {
      console.error("[Rules] Failed to delete rule:", deleteError);
      throw new ApiError(500, "Failed to delete rule");
    }

    // Audit the deletion.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "rule.deleted",
      resourceType: "approval_rule",
      resourceId: id,
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.rules(auth.orgId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
