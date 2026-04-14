// ---------------------------------------------------------------------------
// OKrunit -- Admin Impersonate API
// POST: Switch the app admin's default org to a target org.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { getAppAdminContext } from "@/lib/app-admin";

const bodySchema = z.object({
  org_id: z.string().uuid("Invalid org ID"),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate and verify app admin
    const profile = await getAppAdminContext();
    if (!profile) {
      throw new ApiError(403, "App admin access required", "APP_ADMIN_REQUIRED");
    }

    const admin = createAdminClient();

    // 3. Parse body
    const body = await request.json();
    const { org_id } = bodySchema.parse(body);

    // 4. Verify the target org exists
    const { data: targetOrg } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", org_id)
      .single();

    if (!targetOrg) {
      throw new ApiError(404, "Organization not found", "ORG_NOT_FOUND");
    }

    // 5. Check if admin already has a membership in this org
    const { data: existingMembership } = await admin
      .from("org_memberships")
      .select("id")
      .eq("user_id", profile.id)
      .eq("org_id", org_id)
      .maybeSingle();

    if (!existingMembership) {
      // Create a membership for the admin in the target org
      await admin.from("org_memberships").insert({
        user_id: profile.id,
        org_id,
        role: "owner",
        is_default: false,
      });
    }

    // 6. Unset current default
    await admin
      .from("org_memberships")
      .update({ is_default: false })
      .eq("user_id", profile.id)
      .eq("is_default", true);

    // 7. Set new default to the target org
    await admin
      .from("org_memberships")
      .update({ is_default: true })
      .eq("user_id", profile.id)
      .eq("org_id", org_id);

    // Audit trail for admin impersonation
    await logAuditEvent({
      orgId: org_id,
      userId: profile.id,
      action: "admin.impersonate",
      resourceType: "organization",
      resourceId: org_id,
      ipAddress: getClientIp(request),
      details: {
        admin_user_id: profile.id,
        target_org_id: org_id,
        target_org_name: targetOrg.name,
      },
    });

    return NextResponse.json({
      ok: true,
      org_id: targetOrg.id,
      org_name: targetOrg.name,
      message: `Switched to organization: ${targetOrg.name}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
