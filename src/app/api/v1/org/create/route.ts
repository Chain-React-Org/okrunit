// ---------------------------------------------------------------------------
// OKrunit -- Organization API: Create New Organization
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { canCreateOrganization } from "@/lib/billing/enforce";

// ---- Validation -----------------------------------------------------------

const createOrgSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name is too long")
    .transform((s) => s.trim()),
});

// ---- POST /api/v1/org/create ----------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can create organizations");
    }

    let body: z.infer<typeof createOrgSchema>;
    try {
      body = createOrgSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Enforce organization limit based on user's best plan
    const orgCheck = await canCreateOrganization(auth.user.id);
    if (!orgCheck.allowed) {
      return NextResponse.json(
        { error: orgCheck.reason, upgradeRequired: true },
        { status: 403 },
      );
    }

    const admin = createAdminClient();

    // Create the organization
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: body.name })
      .select("*")
      .single();

    if (orgError || !org) {
      console.error("[Org] Failed to create organization:", orgError);
      throw new ApiError(500, "Failed to create organization");
    }

    // Create membership as owner
    const { error: memberError } = await admin
      .from("org_memberships")
      .insert({
        user_id: auth.user.id,
        org_id: org.id,
        role: "owner",
        is_default: false,
        can_approve: true,
      });

    if (memberError) {
      console.error("[Org] Failed to create membership:", memberError);
      // Clean up the org
      await admin.from("organizations").delete().eq("id", org.id);
      throw new ApiError(500, "Failed to create organization membership");
    }

    // Create a default team
    const { error: teamError } = await admin
      .from("teams")
      .insert({
        org_id: org.id,
        name: "My Team",
        description: null,
        created_by: auth.user.id,
      });

    if (teamError) {
      console.error("[Org] Failed to create default team:", teamError);
      // Non-fatal. Org still works without a team.
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: org.id,
      userId: auth.user.id,
      action: "organization.created",
      resourceType: "organization",
      resourceId: org.id,
      details: { name: body.name },
      ipAddress,
    });

    return NextResponse.json({ data: org }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
