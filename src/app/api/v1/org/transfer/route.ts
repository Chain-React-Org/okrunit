// ---------------------------------------------------------------------------
// OKRunit -- Transfer Organization Ownership
// ---------------------------------------------------------------------------
// Transfers the owner role from the current owner to another org member.
// The current owner is demoted to admin.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const transferSchema = z.object({
  new_owner_id: z.string().uuid("Invalid user ID"),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can transfer ownership");
    }

    // Only the current owner can transfer
    if (auth.membership.role !== "owner") {
      throw new ApiError(403, "Only the organization owner can transfer ownership");
    }

    let body: z.infer<typeof transferSchema>;
    try {
      body = transferSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    if (body.new_owner_id === auth.user.id) {
      throw new ApiError(400, "You are already the owner");
    }

    const admin = createAdminClient();

    // Verify the target user is a member of this org
    const { data: targetMembership } = await admin
      .from("org_memberships")
      .select("id, user_id, role")
      .eq("user_id", body.new_owner_id)
      .eq("org_id", auth.orgId)
      .single();

    if (!targetMembership) {
      throw new ApiError(404, "User is not a member of this organization");
    }

    // Atomically promote new owner and demote current owner
    const { error: rpcError } = await admin.rpc("transfer_org_ownership", {
      p_org_id: auth.orgId,
      p_old_owner_id: auth.user.id,
      p_new_owner_id: body.new_owner_id,
    });

    if (rpcError) {
      logger.error("[Transfer] RPC error:", rpcError);
      throw new ApiError(500, "Failed to transfer ownership");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "org.ownership_transferred",
      resourceType: "organization",
      resourceId: auth.orgId,
      details: {
        from_user_id: auth.user.id,
        to_user_id: body.new_owner_id,
      },
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
