// ---------------------------------------------------------------------------
// OKrunit -- Custom Roles API: Update + Delete
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  base_role: z.enum(["member", "approver", "admin"]).optional(),
  color: z.string().max(20).optional(),
  can_approve: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") throw new ApiError(403, "Session required");
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const body = updateRoleSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("custom_roles")
      .update(body)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (error || !data) throw new ApiError(404, "Role not found");

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "custom_role.updated",
      resourceType: "custom_role",
      resourceId: id,
      details: body as Record<string, unknown>,
    });

    revalidateTags(CacheTags.roles(auth.orgId), CacheTags.members(auth.orgId));

    return NextResponse.json({ data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") throw new ApiError(403, "Session required");
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Clear custom_role_id from any members using this role
    await admin
      .from("org_memberships")
      .update({ custom_role_id: null })
      .eq("custom_role_id", id);

    const { error } = await admin
      .from("custom_roles")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (error) throw new ApiError(500, "Failed to delete role");

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "custom_role.deleted",
      resourceType: "custom_role",
      resourceId: id,
    });

    revalidateTags(CacheTags.roles(auth.orgId), CacheTags.members(auth.orgId));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
