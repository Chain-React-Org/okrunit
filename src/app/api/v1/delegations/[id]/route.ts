// ---------------------------------------------------------------------------
// OKrunit -- Delegations API: DELETE (cancel delegation)
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInAppNotification } from "@/lib/notifications/in-app";
import { cancelDelegation, DelegationError } from "@/lib/api/delegation";
import { titleCaseName } from "@/lib/format-name";

// ---- DELETE /api/v1/delegations/[id] --------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can manage delegations",
        "SESSION_REQUIRED",
      );
    }

    // Verify the delegation belongs to this user (as delegator) in this org
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("approval_delegations")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "Delegation not found", "NOT_FOUND");
    }

    // Only the delegator or an admin/owner can cancel
    if (
      existing.delegator_id !== auth.user.id &&
      auth.membership.role !== "admin" &&
      auth.membership.role !== "owner"
    ) {
      throw new ApiError(
        403,
        "Only the delegator or an org admin can cancel a delegation",
        "FORBIDDEN",
      );
    }

    const cancelled = await cancelDelegation(auth.orgId, id);

    // Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "delegation.cancelled",
      resourceType: "approval_delegation",
      resourceId: id,
      details: {
        delegator_id: existing.delegator_id,
        delegate_id: existing.delegate_id,
      },
      ipAddress,
    });

    // Notify the delegate that their eligibility was revoked, unless it was
    // the delegate themselves who (somehow) triggered the cancel.
    if (existing.delegate_id !== auth.user.id) {
      after(async () => {
        try {
          const { data: delegatorProfile } = await admin
            .from("user_profiles")
            .select("id, full_name, email")
            .eq("id", existing.delegator_id)
            .single();
          const delegatorName =
            titleCaseName(delegatorProfile?.full_name) ||
            delegatorProfile?.email ||
            "A teammate";

          await createInAppNotification({
            userId: existing.delegate_id,
            orgId: auth.orgId,
            category: "delegation_revoked",
            title: `${delegatorName} cancelled their delegation to you`,
            body: `You no longer cover requests routed to ${titleCaseName(delegatorProfile?.full_name) || "them"}. Any open requests revert to the original approver.`,
            actorId: existing.delegator_id,
            actorName: delegatorName,
            resourceType: "approval_delegation",
            resourceId: id,
          });
        } catch {
          // Non-critical.
        }
      });
    }

    return NextResponse.json(cancelled);
  } catch (error) {
    if (error instanceof DelegationError) {
      const status = error.code === "NOT_FOUND" ? 404 : 500;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    return errorResponse(error);
  }
}
