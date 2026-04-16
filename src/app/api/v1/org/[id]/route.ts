// ---------------------------------------------------------------------------
// OKrunit -- Organization API: Delete Organization
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { stripe } from "@/lib/billing/stripe";

// ---- DELETE /api/v1/org/[id] ------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orgId } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can delete organizations");
    }

    const admin = createAdminClient();

    // Verify the org exists
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      throw new ApiError(404, "Organization not found");
    }

    // Verify the user is the owner of THIS org
    const { data: membership, error: memberError } = await admin
      .from("org_memberships")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("org_id", orgId)
      .single();

    if (memberError || !membership || membership.role !== "owner") {
      throw new ApiError(403, "Only the organization owner can delete it");
    }

    // Cannot delete the user's last organization
    const { data: allMemberships } = await admin
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", auth.user.id);

    if (!allMemberships || allMemberships.length <= 1) {
      throw new ApiError(400, "Cannot delete your last organization");
    }

    // If deleting the active org, auto-switch to another one first
    const isDeletingActive = auth.orgId === orgId;
    let switchedToOrgId: string | null = null;

    if (isDeletingActive) {
      const otherOrg = allMemberships.find((m) => m.org_id !== orgId);
      if (!otherOrg) {
        throw new ApiError(400, "Cannot delete your last organization");
      }

      // Clear current default and set new one
      await admin
        .from("org_memberships")
        .update({ is_default: false })
        .eq("user_id", auth.user.id)
        .eq("is_default", true);

      await admin
        .from("org_memberships")
        .update({ is_default: true })
        .eq("user_id", auth.user.id)
        .eq("org_id", otherOrg.org_id);

      switchedToOrgId = otherOrg.org_id;
    }

    // Cancel Stripe subscription if applicable
    if (stripe) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("org_id", orgId)
        .not("stripe_subscription_id", "is", null)
        .in("status", ["active", "trialing"])
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        } catch (stripeErr) {
          console.error("[Org] Failed to cancel Stripe subscription:", stripeErr);
        }
      }
    }

    // Log audit event to the surviving org
    const auditOrgId = isDeletingActive ? switchedToOrgId! : auth.orgId;
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auditOrgId,
      userId: auth.user.id,
      action: "organization.deleted",
      resourceType: "organization",
      resourceId: orgId,
      details: { name: org.name },
      ipAddress,
    });

    // Delete the organization using the dedicated function that handles
    // the audit_log append-only trigger
    const { error: deleteError } = await admin.rpc("delete_organization", {
      target_org_id: orgId,
    });

    if (deleteError) {
      console.error("[Org] Failed to delete organization:", deleteError);
      throw new ApiError(500, "Failed to delete organization");
    }

    revalidateTags(
      CacheTags.organizations(auth.user.id),
      CacheTags.orgContext(auth.user.id),
    );

    return NextResponse.json({
      success: true,
      switched_to: switchedToOrgId,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
