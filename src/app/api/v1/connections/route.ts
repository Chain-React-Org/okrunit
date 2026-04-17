// ---------------------------------------------------------------------------
// OKrunit -- Connections API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest, generateApiKey } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createConnectionSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { canCreateConnection } from "@/lib/billing/enforce";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { logger } from "@/lib/monitoring/logger";

// ---- Column allowlist (never return api_key_hash) -------------------------

const CONNECTION_COLUMNS =
  "id, org_id, name, description, api_key_prefix, is_active, rate_limit_per_hour, allowed_action_types, max_priority, scoping_rules, last_used_at, rotated_at, created_by, created_at, updated_at" as const;

// ---- GET /api/v1/connections ----------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage connections.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage connections");
    }

    const admin = createAdminClient();

    const { data: connections, error } = await admin
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[Connections] Failed to list connections:", error);
      throw new ApiError(500, "Failed to list connections");
    }

    return NextResponse.json({ data: connections });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/connections ---------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may create connections.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage connections");
    }

    // Must have connect permission (owner/admin always have it, others need can_connect).
    if (!auth.membership.can_connect) {
      throw new ApiError(403, "You don't have permission to create connections. Ask an admin to grant connect access.");
    }

    // Billing plan enforcement
    const billingCheck = await canCreateConnection(auth.orgId);
    if (!billingCheck.allowed) {
      return NextResponse.json(
        {
          error: billingCheck.reason,
          code: "PLAN_LIMIT_EXCEEDED",
          upgrade_required: true,
          limit: billingCheck.limit,
          current: billingCheck.current,
          plan: billingCheck.plan,
        },
        { status: 403 },
      );
    }

    // Validate request body.
    let body: z.infer<typeof createConnectionSchema>;
    try {
      body = createConnectionSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Generate the API key material.
    const { plaintext, hash, prefix } = generateApiKey();

    const admin = createAdminClient();

    const { data: connection, error } = await admin
      .from("connections")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        rate_limit_per_hour: body.rate_limit_per_hour ?? 100,
        allowed_action_types: body.allowed_action_types ?? null,
        max_priority: body.max_priority ?? null,
        api_key_hash: hash,
        api_key_prefix: prefix,
        is_active: true,
        created_by: auth.user.id,
      })
      .select(CONNECTION_COLUMNS)
      .single();

    if (error || !connection) {
      logger.error("[Connections] Failed to create connection:", error);
      throw new ApiError(500, "Failed to create connection");
    }

    // Audit the creation.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "connection.created",
      resourceType: "connection",
      resourceId: connection.id,
      details: { name: body.name },
      ipAddress,
    });

    revalidateTags(CacheTags.connections(auth.orgId), CacheTags.overview(auth.orgId));

    // Return the connection with the plaintext key (shown only once).
    return NextResponse.json(
      {
        data: connection,
        api_key: plaintext,
        api_key_warning:
          "Store this key securely. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
