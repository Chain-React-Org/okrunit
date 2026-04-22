// ---------------------------------------------------------------------------
// OKrunit -- Reassign Approval Request
// ---------------------------------------------------------------------------
// POST: Reassign a pending approval to different approvers
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const reassignSchema = z.object({
  approval_id: z.string().uuid(),
  assigned_approvers: z.array(z.string().uuid()).max(10).nullable().optional(),
  assigned_team_id: z.string().uuid().nullable().optional(),
  required_approvals: z.number().int().min(1).max(10).optional(),
  is_sequential: z.boolean().optional(),
  required_role: z.enum(["owner", "admin", "approver", "member"]).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      throw new ApiError(403, "Session required");
    }

    const body = reassignSchema.parse(await request.json());
    const hasAnyField =
      body.assigned_approvers !== undefined ||
      body.assigned_team_id !== undefined ||
      body.required_approvals !== undefined ||
      body.is_sequential !== undefined ||
      body.required_role !== undefined;
    if (!hasAnyField) {
      throw new ApiError(400, "Provide at least one field to update");
    }

    const admin = createAdminClient();

    // Verify the request exists, is pending, and belongs to this org
    const { data: approval, error } = await admin
      .from("approval_requests")
      .select("id, status, org_id, current_approvals")
      .eq("id", body.approval_id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !approval) {
      throw new ApiError(404, "Approval not found");
    }
    if (approval.status !== "pending") {
      throw new ApiError(400, "Can only reassign pending approvals");
    }

    // Update the assignment. Only forward fields that were explicitly
    // provided so callers can clear a value (null) vs. leave it unchanged
    // (undefined).
    const updateData: Record<string, unknown> = {};
    if (body.assigned_approvers !== undefined) {
      updateData.assigned_approvers = body.assigned_approvers;
    }
    if (body.assigned_team_id !== undefined) {
      updateData.assigned_team_id = body.assigned_team_id;
    }
    if (body.required_approvals !== undefined) {
      // Clamp to current progress to avoid creating an already-fulfilled
      // request (required <= current would resolve immediately).
      const clamped = Math.max(body.required_approvals, approval.current_approvals + 1);
      updateData.required_approvals = clamped;
    }
    if (body.is_sequential !== undefined) {
      updateData.is_sequential = body.is_sequential;
    }
    if (body.required_role !== undefined) {
      updateData.required_role = body.required_role;
    }

    await admin
      .from("approval_requests")
      .update(updateData)
      .eq("id", body.approval_id);

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "approval.reassigned",
      resourceType: "approval_request",
      resourceId: body.approval_id,
      details: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
