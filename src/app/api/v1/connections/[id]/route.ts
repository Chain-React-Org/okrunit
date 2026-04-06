// ---------------------------------------------------------------------------
// OKrunit -- Connections API: Update + Deactivate (single connection)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { updateConnectionSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Column allowlist (never return api_key_hash) -------------------------

const CONNECTION_COLUMNS =
  "id, org_id, name, description, api_key_prefix, is_active, rate_limit_per_hour, allowed_action_types, max_priority, scoping_rules, last_used_at, rotated_at, created_by, created_at, updated_at" as const;

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- PATCH /api/v1/connections/[id] ---------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage connections.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage connections");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof updateConnectionSchema>;
    try {
      body = updateConnectionSchema.parse(await request.json());
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

    // Verify the connection exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("connections")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Connection not found");
    }

    // Apply the partial update.
    const { data: connection, error: updateError } = await admin
      .from("connections")
      .update(body)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select(CONNECTION_COLUMNS)
      .single();

    if (updateError || !connection) {
      console.error("[Connections] Failed to update connection:", updateError);
      throw new ApiError(500, "Failed to update connection");
    }

    // Audit the update.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "connection.updated",
      resourceType: "connection",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.connections(auth.orgId), CacheTags.overview(auth.orgId));

    return NextResponse.json({ data: connection });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/connections/[id] --------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage connections.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage connections");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the connection exists and belongs to this org.
    const { data: existing, error: fetchError } = await admin
      .from("connections")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Connection not found");
    }

    // Hard-delete the connection row.
    const { error: deleteError } = await admin
      .from("connections")
      .delete()
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (deleteError) {
      console.error(
        "[Connections] Failed to delete connection:",
        deleteError,
      );
      throw new ApiError(500, "Failed to delete connection");
    }

    // Audit the deletion.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "connection.deleted",
      resourceType: "connection",
      resourceId: id,
      ipAddress: getIpAddress(request),
    });

    revalidateTags(CacheTags.connections(auth.orgId), CacheTags.overview(auth.orgId));

    return NextResponse.json({ data: { id } });
  } catch (err) {
    return errorResponse(err);
  }
}
