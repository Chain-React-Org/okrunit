// ---------------------------------------------------------------------------
// OKRunit -- Team Members API: List, Update Role, Remove
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- Validation -----------------------------------------------------------

const updateRoleSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  role: z.enum(["admin", "approver", "member"]).optional(),
  can_approve: z.boolean().optional(),
});

const removeMemberSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
});

// ---- GET /api/v1/team/members ---------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session or OAuth (Zapier needs this for dynamic dropdowns).
    // API keys cannot list team members.
    if (auth.type === "api_key") {
      throw new ApiError(403, "API key auth not supported for listing team members");
    }

    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const filterApprovers = searchParams.get("can_approve") === "true";

    // Fetch memberships for this org, joined with user profiles
    let query = admin
      .from("org_memberships")
      .select("id, user_id, org_id, role, can_approve, is_default, created_at, updated_at")
      .eq("org_id", auth.orgId)
      .order("role", { ascending: true })
      .order("created_at", { ascending: true });

    if (filterApprovers) {
      query = query.eq("can_approve", true);
    }

    const { data: memberships, error } = await query;

    if (error) {
      console.error("[Team] Failed to list members:", error);
      throw new ApiError(500, "Failed to list members");
    }

    // Fetch the user profiles for these members
    const userIds = (memberships ?? []).map((m) => m.user_id);
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p]),
    );

    // Combine into a flat structure matching what the frontend expects
    const members = (memberships ?? []).map((m) => {
      const profile = profileMap.get(m.user_id);
      return {
        id: m.user_id,
        email: profile?.email ?? "",
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: m.role,
        can_approve: m.can_approve,
        created_at: m.created_at,
        updated_at: m.updated_at,
      };
    });

    return NextResponse.json({ data: members });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/team/members -------------------------------------------

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session-only, admin or owner.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage team members");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof updateRoleSchema>;
    try {
      body = updateRoleSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Role changes: owners can set any role; admins can set approver/member.
    if (body.role) {
      if (body.role === "admin" && auth.membership.role !== "owner") {
        throw new ApiError(403, "Only owners can promote to admin");
      }
      if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
        throw new ApiError(403, "Insufficient permissions to change roles");
      }
    }

    const admin = createAdminClient();

    // Verify the target user has a membership in this org.
    const { data: targetMembership } = await admin
      .from("org_memberships")
      .select("id, role, can_approve")
      .eq("user_id", body.user_id)
      .eq("org_id", auth.orgId)
      .single();

    if (!targetMembership) {
      throw new ApiError(404, "Member not found");
    }

    // Role-change specific validation.
    if (body.role) {
      // Cannot change own role.
      if (body.user_id === auth.user.id) {
        throw new ApiError(400, "You cannot change your own role", "SELF_CHANGE");
      }

      // Cannot demote the last owner.
      if (targetMembership.role === "owner") {
        const { count } = await admin
          .from("org_memberships")
          .select("*", { count: "exact", head: true })
          .eq("org_id", auth.orgId)
          .eq("role", "owner");

        if ((count ?? 0) <= 1) {
          throw new ApiError(
            400,
            "Cannot demote the last owner",
            "LAST_OWNER",
          );
        }
      }
    }

    // Build the update payload.
    const updatePayload: Record<string, unknown> = {};
    if (body.role) updatePayload.role = body.role;
    if (body.can_approve !== undefined) updatePayload.can_approve = body.can_approve;

    if (Object.keys(updatePayload).length === 0) {
      throw new ApiError(400, "Nothing to update");
    }

    // Apply the update on org_memberships.
    const { error: updateError } = await admin
      .from("org_memberships")
      .update(updatePayload)
      .eq("user_id", body.user_id)
      .eq("org_id", auth.orgId);

    if (updateError) {
      console.error("[Team] Failed to update member:", updateError);
      throw new ApiError(500, "Failed to update member");
    }

    // Audit the change.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const auditDetails: Record<string, unknown> = {};
    if (body.role) {
      auditDetails.old_role = targetMembership.role;
      auditDetails.new_role = body.role;
    }
    if (body.can_approve !== undefined) {
      auditDetails.old_can_approve = targetMembership.can_approve;
      auditDetails.new_can_approve = body.can_approve;
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: body.role ? "member.role_changed" : "member.updated",
      resourceType: "org_membership",
      resourceId: body.user_id,
      details: auditDetails,
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/team/members ------------------------------------------

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session-only, admin or owner.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage team members");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof removeMemberSchema>;
    try {
      body = removeMemberSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Cannot remove yourself.
    if (body.user_id === auth.user.id) {
      throw new ApiError(400, "You cannot remove yourself", "SELF_REMOVAL");
    }

    const admin = createAdminClient();

    // Verify the target user has a membership in this org.
    const { data: targetMembership } = await admin
      .from("org_memberships")
      .select("id, role, user_id")
      .eq("user_id", body.user_id)
      .eq("org_id", auth.orgId)
      .single();

    if (!targetMembership) {
      throw new ApiError(404, "Member not found");
    }

    // Get the target user's email for audit
    const { data: targetProfile } = await admin
      .from("user_profiles")
      .select("email")
      .eq("id", body.user_id)
      .single();

    // Cannot remove the last owner.
    if (targetMembership.role === "owner") {
      const { count } = await admin
        .from("org_memberships")
        .select("*", { count: "exact", head: true })
        .eq("org_id", auth.orgId)
        .eq("role", "owner");

      if ((count ?? 0) <= 1) {
        throw new ApiError(
          400,
          "Cannot remove the last owner",
          "LAST_OWNER",
        );
      }
    }

    // Delete the membership (removes them from the org, not from auth.users).
    const { error: deleteError } = await admin
      .from("org_memberships")
      .delete()
      .eq("user_id", body.user_id)
      .eq("org_id", auth.orgId);

    if (deleteError) {
      console.error("[Team] Failed to remove member:", deleteError);
      throw new ApiError(500, "Failed to remove member");
    }

    // Audit the removal.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "member.removed",
      resourceType: "org_membership",
      resourceId: body.user_id,
      details: { email: targetProfile?.email, role: targetMembership.role },
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
