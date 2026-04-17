// ---------------------------------------------------------------------------
// OKrunit -- Messaging Connection PATCH (update routing rules + settings)
// ---------------------------------------------------------------------------
// PATCH /api/v1/messaging/connections/[id]
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { updateMessagingConnectionSchema } from "@/lib/api/validation";
import { z } from "zod";
import { logger } from "@/lib/monitoring/logger";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: connectionId } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    const orgId = auth.orgId;
    const userId = auth.user.id;
    const admin = createAdminClient();

    // Verify the connection belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("messaging_connections")
      .select("id, platform, workspace_name, channel_name")
      .eq("id", connectionId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Messaging connection not found");
    }

    const { error: deleteError } = await admin
      .from("messaging_connections")
      .delete()
      .eq("id", connectionId)
      .eq("org_id", orgId);

    if (deleteError) {
      logger.error("[Messaging Connections] Delete failed:", deleteError);
      throw new ApiError(500, "Failed to delete connection");
    }

    logAuditEvent({
      orgId,
      userId,
      action: "messaging_connection.deleted",
      resourceType: "messaging_connection",
      resourceId: connectionId,
      ipAddress: getClientIp(request),
      details: {
        platform: existing.platform,
        workspace_name: existing.workspace_name,
        channel_name: existing.channel_name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: connectionId } = await params;
    const auth = await authenticateRequest(request);

    // Session auth only, admin/owner required
    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    const orgId = auth.orgId;
    const userId = auth.user.id;

    // Validate request body
    const body = await request.json();
    const validated = updateMessagingConnectionSchema.parse(body);

    // Ensure at least one field is being updated
    if (Object.keys(validated).length === 0) {
      return NextResponse.json(
        { error: "At least one field must be provided to update" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Verify the connection belongs to this org
    const { data: existing, error: fetchError } = await admin
      .from("messaging_connections")
      .select("id, platform, workspace_name, channel_name, routing_rules, priority_filter, notify_on_create, notify_on_decide")
      .eq("id", connectionId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Messaging connection not found");
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.routing_rules !== undefined) {
      updatePayload.routing_rules = validated.routing_rules;
    }
    if (validated.priority_filter !== undefined) {
      updatePayload.priority_filter = validated.priority_filter;
    }
    if (validated.notify_on_create !== undefined) {
      updatePayload.notify_on_create = validated.notify_on_create;
    }
    if (validated.notify_on_decide !== undefined) {
      updatePayload.notify_on_decide = validated.notify_on_decide;
    }

    const { data: updated, error: updateError } = await admin
      .from("messaging_connections")
      .update(updatePayload)
      .eq("id", connectionId)
      .eq("org_id", orgId)
      .select("id, org_id, platform, workspace_id, workspace_name, channel_id, channel_name, is_active, notify_on_create, notify_on_decide, priority_filter, routing_rules, installed_by, created_at, updated_at")
      .single();

    if (updateError || !updated) {
      logger.error("[Messaging Connections] Update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to update messaging connection" },
        { status: 500 },
      );
    }

    // Audit log
    logAuditEvent({
      orgId,
      userId,
      action: "messaging_connection.updated",
      resourceType: "messaging_connection",
      resourceId: connectionId,
      ipAddress: getClientIp(request),
      details: {
        platform: existing.platform,
        channel_name: existing.channel_name,
        changes: validated,
      },
    });

    return NextResponse.json({ connection: updated });
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
