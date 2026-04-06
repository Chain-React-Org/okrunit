// ---------------------------------------------------------------------------
// OKrunit -- API Key Rotation Endpoint
// POST /api/v1/connections/[id]/rotate
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest, generateApiKey } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Validation -----------------------------------------------------------

const rotateBodySchema = z
  .object({
    grace_period_hours: z.number().min(0).max(168).optional(), // max 7 days
  })
  .optional();

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- POST /api/v1/connections/[id]/rotate --------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may rotate keys.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can rotate API keys");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Parse optional body.
    let body: z.infer<typeof rotateBodySchema>;
    try {
      const rawBody = await request.text();
      body = rawBody ? rotateBodySchema.parse(JSON.parse(rawBody)) : undefined;
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    const gracePeriodHours = body?.grace_period_hours ?? 24;

    const admin = createAdminClient();

    // Verify the connection exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("connections")
      .select("id, api_key_hash, api_key_prefix, org_id, name")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Connection not found");
    }

    // Generate the new API key material.
    const { plaintext, hash, prefix } = generateApiKey();

    // Compute grace period expiry.
    const previousKeyExpiresAt = new Date(
      Date.now() + gracePeriodHours * 60 * 60 * 1000,
    ).toISOString();

    // Rotate: move current key to previous, install the new key.
    const { data: connection, error: updateError } = await admin
      .from("connections")
      .update({
        previous_key_hash: existing.api_key_hash,
        previous_key_expires_at: previousKeyExpiresAt,
        api_key_hash: hash,
        api_key_prefix: prefix,
        rotated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select(
        "id, org_id, name, description, api_key_prefix, is_active, rate_limit_per_hour, allowed_action_types, max_priority, scoping_rules, last_used_at, rotated_at, created_by, created_at, updated_at",
      )
      .single();

    if (updateError || !connection) {
      console.error("[Connections] Failed to rotate API key:", updateError);
      throw new ApiError(500, "Failed to rotate API key");
    }

    // Audit the rotation.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "connection.key_rotated",
      resourceType: "connection",
      resourceId: id,
      details: {
        connection_name: existing.name,
        grace_period_hours: gracePeriodHours,
      },
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.connections(auth.orgId));

    return NextResponse.json({
      data: connection,
      api_key: plaintext,
      api_key_warning:
        "Store this key securely. It will not be shown again.",
      grace_period: {
        hours: gracePeriodHours,
        previous_key_expires_at: previousKeyExpiresAt,
        message: `The previous API key will continue to work until ${new Date(previousKeyExpiresAt).toLocaleString()}. Please update your integration before then.`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
