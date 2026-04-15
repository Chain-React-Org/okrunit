// ---------------------------------------------------------------------------
// OKrunit -- Trust Counters API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createTrustCounterSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { canUseFeature } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- GET /api/v1/trust ----------------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage trust counters.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage trust counters");
    }

    const admin = createAdminClient();

    const { data: counters, error } = await admin
      .from("approval_trust_counters")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Trust] Failed to list trust counters:", error);
      throw new ApiError(500, "Failed to list trust counters");
    }

    return NextResponse.json({ data: counters });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/trust ---------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may create trust counters.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage trust counters");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const featureCheck = await canUseFeature(auth.orgId, "rules_engine");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Trust counters require a Pro plan or higher", "PLAN_LIMIT_EXCEEDED");
    }

    // Validate request body.
    let body: z.infer<typeof createTrustCounterSchema>;
    try {
      body = createTrustCounterSchema.parse(await request.json());
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

    const { data: counter, error } = await admin
      .from("approval_trust_counters")
      .insert({
        org_id: auth.orgId,
        match_field: body.match_field,
        match_value: body.match_value,
        auto_approve_threshold: body.auto_approve_threshold ?? null,
      })
      .select("*")
      .single();

    if (error || !counter) {
      // Handle unique constraint violation.
      if (error?.code === "23505") {
        throw new ApiError(
          409,
          "A trust counter with this match_field and match_value already exists for this org",
          "DUPLICATE_COUNTER",
        );
      }
      console.error("[Trust] Failed to create trust counter:", error);
      throw new ApiError(500, "Failed to create trust counter");
    }

    // Audit the creation.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "trust_counter.created",
      resourceType: "approval_trust_counter",
      resourceId: counter.id,
      details: {
        match_field: body.match_field,
        match_value: body.match_value,
        auto_approve_threshold: body.auto_approve_threshold ?? null,
      },
      ipAddress,
    });

    return NextResponse.json({ data: counter }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
