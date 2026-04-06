// ---------------------------------------------------------------------------
// OKrunit -- Organization Action Types API: GET + PUT
// ---------------------------------------------------------------------------
// Manages the org-level list of action types used for dynamic dropdowns
// in Zapier and for filtering/rules in the dashboard.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- Validation -----------------------------------------------------------

const updateActionTypesSchema = z.object({
  action_types: z
    .array(z.string().min(1).max(100))
    .max(100, "Maximum 100 action types allowed"),
});

// ---- GET /api/v1/org/action-types ----------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Allow session, OAuth (for Zapier dynamic dropdowns), and API key (for n8n)

    const admin = createAdminClient();

    const { data: org, error } = await admin
      .from("organizations")
      .select("action_types")
      .eq("id", auth.orgId)
      .single();

    if (error || !org) {
      throw new ApiError(500, "Failed to fetch organization");
    }

    return NextResponse.json({ data: org.action_types ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PUT /api/v1/org/action-types ----------------------------------------

export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Session-only for writes
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage action types");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    let body: z.infer<typeof updateActionTypesSchema>;
    try {
      body = updateActionTypesSchema.parse(await request.json());
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

    // Deduplicate and sort
    const uniqueTypes = [...new Set(body.action_types)].sort();

    const { data: org, error } = await admin
      .from("organizations")
      .update({ action_types: uniqueTypes })
      .eq("id", auth.orgId)
      .select("action_types")
      .single();

    if (error || !org) {
      console.error("[Org] Failed to update action types:", error);
      throw new ApiError(500, "Failed to update action types");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "organization.action_types_updated",
      resourceType: "organization",
      resourceId: auth.orgId,
      details: { action_types: uniqueTypes },
      ipAddress,
    });

    return NextResponse.json({ data: org.action_types });
  } catch (err) {
    return errorResponse(err);
  }
}
