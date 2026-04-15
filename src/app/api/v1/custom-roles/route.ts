// ---------------------------------------------------------------------------
// OKrunit -- Custom Roles API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { canUseFeature } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  base_role: z.enum(["member", "approver", "admin"]),
  color: z.string().max(20).optional(),
  can_approve: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      throw new ApiError(403, "Session required");
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("custom_roles")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("name");

    if (error) throw new ApiError(500, "Failed to list roles");

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      throw new ApiError(403, "Session required");
    }
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const featureCheck = await canUseFeature(auth.orgId, "custom_routing");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Custom roles require a Business plan or higher", "PLAN_LIMIT_EXCEEDED");
    }

    let body: z.infer<typeof createRoleSchema>;
    try {
      body = createRoleSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Validation failed", issues: err.issues }, { status: 400 });
      }
      throw err;
    }

    const admin = createAdminClient();

    // Default can_approve based on base_role
    const canApprove = body.can_approve ?? (body.base_role !== "member");

    const { data, error } = await admin
      .from("custom_roles")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        base_role: body.base_role,
        color: body.color ?? "#6b7280",
        can_approve: canApprove,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ApiError(409, "A role with this name already exists");
      }
      throw new ApiError(500, "Failed to create role");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "custom_role.created",
      resourceType: "custom_role",
      resourceId: data.id,
      details: { name: body.name, base_role: body.base_role },
    });

    revalidateTags(CacheTags.roles(auth.orgId));

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
