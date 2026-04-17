// ---------------------------------------------------------------------------
// OKrunit -- Webhook Notification Channel CRUD
// ---------------------------------------------------------------------------
// GET  /api/v1/messaging/webhook       -- List webhook channels for the org
// POST /api/v1/messaging/webhook       -- Create a new webhook channel
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { canUseFeature } from "@/lib/billing/enforce";
import { resolveAndCheckUrl } from "@/lib/api/ssrf";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  http_method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional().default({}),
  payload_template: z.record(z.string(), z.unknown()).optional().nullable(),
  events: z
    .array(z.string())
    .min(1)
    .default(["request.created"]),
});

// ---------------------------------------------------------------------------
// GET -- List webhook channels
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const admin = createAdminClient();

    const { data: channels, error } = await admin
      .from("webhook_notification_channels")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[Webhook Channels] Failed to list:", error);
      return NextResponse.json(
        { error: "Failed to load webhook channels" },
        { status: 500 },
      );
    }

    return NextResponse.json({ channels: channels ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// POST -- Create a new webhook channel
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    if (!["owner", "admin"].includes(auth.membership.role)) {
      throw new ApiError(403, "Admin or owner role required");
    }

    // Check billing: webhook_notifications feature required (Pro+)
    const featureCheck = await canUseFeature(auth.orgId, "webhook_notifications");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Upgrade required for webhook notifications");
    }

    const body = await request.json();
    const parsed = createSchema.parse(body);

    // Validate URL against SSRF (prevent targeting internal networks)
    const isPrivate = await resolveAndCheckUrl(parsed.url);
    if (isPrivate) {
      throw new ApiError(400, "Invalid webhook URL: targets a private or reserved network");
    }

    const admin = createAdminClient();

    const { data: channel, error } = await admin
      .from("webhook_notification_channels")
      .insert({
        org_id: auth.orgId,
        name: parsed.name,
        url: parsed.url,
        http_method: parsed.http_method,
        headers: parsed.headers,
        payload_template: parsed.payload_template ?? null,
        events: parsed.events,
        is_active: true,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error) {
      logger.error("[Webhook Channels] Create failed:", error);
      throw new ApiError(500, "Failed to create webhook channel");
    }

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "webhook_channel.created",
      resourceType: "webhook_notification_channel",
      resourceId: channel.id,
      ipAddress: getClientIp(request),
      details: {
        name: parsed.name,
        url: parsed.url,
        http_method: parsed.http_method,
        events: parsed.events,
      },
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
