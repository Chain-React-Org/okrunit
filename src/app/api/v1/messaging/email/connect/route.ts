// ---------------------------------------------------------------------------
// OKrunit -- Email Channel Connect Route
// ---------------------------------------------------------------------------
// POST /api/v1/messaging/email/connect
//
// Accepts an email address (individual or distribution list) and stores it
// as a messaging connection so approval notifications can be routed to it.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

const connectSchema = z.object({
  email: z
    .string()
    .min(1, "Email address is required")
    .email("Invalid email address"),
  channel_name: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    let userId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
      userId = auth.user.id;
      if (!["owner", "admin"].includes(auth.membership.role)) {
        throw new ApiError(403, "Admin or owner role required");
      }
    } else {
      throw new ApiError(401, "Session authentication required");
    }

    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, channel_name } = parsed.data;
    const label = channel_name || email;

    const admin = createAdminClient();

    const { data: connection, error: upsertError } = await admin
      .from("messaging_connections")
      .upsert(
        {
          org_id: orgId,
          platform: "email",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          bot_token: null,
          workspace_id: null,
          workspace_name: null,
          channel_id: email,
          channel_name: label,
          webhook_url: null,
          is_active: true,
          installed_by: userId,
        },
        { onConflict: "org_id,platform,channel_id" },
      )
      .select(
        "id, org_id, platform, workspace_id, workspace_name, channel_id, channel_name, webhook_url, is_active, notify_on_create, notify_on_decide, priority_filter, routing_rules, installed_by, created_at, updated_at",
      )
      .single();

    if (upsertError) {
      logger.error("[Email Connect] Upsert failed:", upsertError);
      return NextResponse.json(
        { error: "Failed to save connection" },
        { status: 500 },
      );
    }

    logAuditEvent({
      orgId,
      userId,
      action: "messaging_connection.created",
      resourceType: "messaging_connection",
      resourceId: connection?.id ?? undefined,
      ipAddress: getClientIp(request),
      details: {
        platform: "email",
        email,
        channel_name: label,
      },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    return errorResponse(error);
  }
}
