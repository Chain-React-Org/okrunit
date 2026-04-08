// ---------------------------------------------------------------------------
// OKrunit -- Connections API: Update + Deactivate (single connection)
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { updateConnectionSchema } from "@/lib/api/validation";
import { logAuditEvent, computeAuditChanges } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInAppNotificationBulk } from "@/lib/notifications/in-app";
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

    // Fetch the current state before update (for change tracking).
    const { data: existing, error: fetchError } = await admin
      .from("connections")
      .select(CONNECTION_COLUMNS)
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

    // Build before/after changes for the audit log
    const connectionTrackedFields = [
      "name", "description", "is_active", "rate_limit_per_hour",
      "allowed_action_types", "max_priority", "scoping_rules",
    ];
    const changes = computeAuditChanges(
      existing as Record<string, unknown>,
      body as Record<string, unknown>,
      connectionTrackedFields,
    );

    // Audit the update.
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "connection.updated",
      resourceType: "connection",
      resourceId: id,
      details: body as Record<string, unknown>,
      ipAddress: getIpAddress(request),
      changes: changes.length > 0 ? changes : undefined,
    });

    revalidateTags(CacheTags.connections(auth.orgId), CacheTags.overview(auth.orgId));

    // Notify admins when a connection is deactivated
    if (body.is_active === false) {
      after(async () => {
        const notifyAdmin = createAdminClient();
        const { data: admins } = await notifyAdmin
          .from("org_memberships")
          .select("user_id")
          .eq("org_id", auth.orgId)
          .in("role", ["owner", "admin"]);
        const adminIds = (admins ?? []).map((m) => m.user_id).filter((uid) => uid !== auth.user.id);
        if (adminIds.length > 0) {
          await createInAppNotificationBulk(adminIds, {
            orgId: auth.orgId,
            category: "connection_deactivated",
            title: "Connection deactivated",
            body: `"${connection.name}" was deactivated. Requests using this connection will be rejected.`,
            resourceType: "connection",
            resourceId: id,
            actorId: auth.user.id,
          });
        }
      });
    }

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

    // Notify admins about the deletion
    after(async () => {
      const notifyAdmin = createAdminClient();
      const { data: admins } = await notifyAdmin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", auth.orgId)
        .in("role", ["owner", "admin"]);
      const adminIds = (admins ?? []).map((m) => m.user_id).filter((uid) => uid !== auth.user.id);
      if (adminIds.length > 0) {
        await createInAppNotificationBulk(adminIds, {
          orgId: auth.orgId,
          category: "connection_deactivated",
          title: "Connection deleted",
          body: `A connection was deleted. Requests using this connection will no longer work.`,
          resourceType: "connection",
          resourceId: id,
          actorId: auth.user.id,
        });
      }
    });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    return errorResponse(err);
  }
}
