// ---------------------------------------------------------------------------
// OKrunit -- Messaging Connections CRUD Route
// ---------------------------------------------------------------------------
// GET  /api/v1/messaging/connections       -- List all connections for the org
// DELETE /api/v1/messaging/connections?id=  -- Remove a connection
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
    } else {
      throw new ApiError(401, "Session authentication required");
    }

    const admin = createAdminClient();

    const { data: connections, error } = await admin
      .from("messaging_connections")
      .select(
        "id, org_id, platform, workspace_id, workspace_name, channel_id, channel_name, is_active, notify_on_create, notify_on_decide, priority_filter, routing_rules, installed_by, created_at, updated_at",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[Messaging Connections] Failed to list:", error);
      return NextResponse.json(
        { error: "Failed to load messaging connections" },
        { status: 500 },
      );
    }

    return NextResponse.json({ connections: connections ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    let userId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
      userId = auth.user.id;
      // Check admin/owner role
      if (!["owner", "admin"].includes(auth.membership.role)) {
        throw new ApiError(403, "Admin or owner role required");
      }
    } else {
      throw new ApiError(401, "Session authentication required");
    }

    const url = new URL(request.url);
    const connectionId = url.searchParams.get("id");

    if (!connectionId) {
      return NextResponse.json(
        { error: "Connection ID is required" },
        { status: 400 },
      );
    }

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

    // Delete the connection
    const { error: deleteError } = await admin
      .from("messaging_connections")
      .delete()
      .eq("id", connectionId)
      .eq("org_id", orgId);

    if (deleteError) {
      logger.error("[Messaging Connections] Delete failed:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete connection" },
        { status: 500 },
      );
    }

    // Audit log
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

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }
    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    const body = await request.json();
    if (!body.id) {
      throw new ApiError(400, "Connection ID is required");
    }

    const admin = createAdminClient();

    // Verify ownership
    const { data: existing } = await admin
      .from("messaging_connections")
      .select("id")
      .eq("id", body.id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "Connection not found");
    }

    // Build update payload from allowed fields
    const update: Record<string, unknown> = {};
    if (body.channel_id !== undefined) update.channel_id = body.channel_id;
    if (body.channel_name !== undefined) update.channel_name = body.channel_name;

    if (Object.keys(update).length === 0) {
      throw new ApiError(400, "Nothing to update");
    }

    const { data: updated, error } = await admin
      .from("messaging_connections")
      .update(update)
      .eq("id", body.id)
      .eq("org_id", auth.orgId)
      .select("id, channel_id, channel_name")
      .single();

    if (error) {
      logger.error("[Messaging Connections] Update failed:", error);
      throw new ApiError(500, "Failed to update connection");
    }

    return NextResponse.json({ success: true, connection: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
