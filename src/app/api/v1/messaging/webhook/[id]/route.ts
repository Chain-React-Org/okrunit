// ---------------------------------------------------------------------------
// OKrunit -- Webhook Notification Channel (Single) CRUD
// ---------------------------------------------------------------------------
// GET    /api/v1/messaging/webhook/:id  -- Get a single channel
// PATCH  /api/v1/messaging/webhook/:id  -- Update a channel
// DELETE /api/v1/messaging/webhook/:id  -- Deactivate (soft delete)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  http_method: z.enum(["POST", "PUT", "PATCH"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  payload_template: z.record(z.string(), z.unknown()).nullable().optional(),
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET -- Single webhook channel
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const admin = createAdminClient();

    const { data: channel, error } = await admin
      .from("webhook_notification_channels")
      .select("*")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !channel) {
      throw new ApiError(404, "Webhook channel not found");
    }

    return NextResponse.json({ channel });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH -- Update a webhook channel
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    const body = await request.json();
    const parsed = updateSchema.parse(body);

    if (Object.keys(parsed).length === 0) {
      throw new ApiError(400, "Nothing to update");
    }

    const admin = createAdminClient();

    // Verify ownership
    const { data: existing } = await admin
      .from("webhook_notification_channels")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "Webhook channel not found");
    }

    const { data: channel, error } = await admin
      .from("webhook_notification_channels")
      .update({
        ...parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .select("*")
      .single();

    if (error) {
      console.error("[Webhook Channels] Update failed:", error);
      throw new ApiError(500, "Failed to update webhook channel");
    }

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "webhook_channel.updated",
      resourceType: "webhook_notification_channel",
      resourceId: id,
      ipAddress: getClientIp(request),
      details: { fields: Object.keys(parsed) },
    });

    return NextResponse.json({ channel });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE -- Soft-delete (deactivate) a webhook channel
// ---------------------------------------------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    const admin = createAdminClient();

    // Verify ownership
    const { data: existing } = await admin
      .from("webhook_notification_channels")
      .select("id, name")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "Webhook channel not found");
    }

    const { error } = await admin
      .from("webhook_notification_channels")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", auth.orgId);

    if (error) {
      console.error("[Webhook Channels] Delete failed:", error);
      throw new ApiError(500, "Failed to deactivate webhook channel");
    }

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "webhook_channel.deleted",
      resourceType: "webhook_notification_channel",
      resourceId: id,
      ipAddress: getClientIp(request),
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
