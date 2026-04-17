// ---------------------------------------------------------------------------
// OKrunit -- Teams Bot Install: Store Conversation Reference
// ---------------------------------------------------------------------------
//
// POST /api/v1/messaging/teams/bot-install
//
// When the Teams bot is added to a team or channel, this endpoint stores the
// conversation reference so the bot can proactively send messages later.
//
// This endpoint is called from the Teams admin UI after installing the bot,
// or can be triggered manually with the conversation details.
//
// Requires session authentication (dashboard user must be logged in).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const botInstallSchema = z.object({
  conversation_id: z
    .string()
    .min(1, "Conversation ID is required")
    .max(500, "Conversation ID is too long"),
  service_url: z
    .string()
    .url("Service URL must be a valid URL")
    .max(1000, "Service URL is too long"),
  tenant_id: z
    .string()
    .min(1, "Tenant ID is required")
    .max(200, "Tenant ID is too long"),
  team_id: z.string().max(200).optional(),
  team_name: z.string().max(200).optional(),
  channel_name: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/v1/messaging/teams/bot-install
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate -- require session auth (dashboard user).
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions. Admin or owner role required.");
    }

    // 2. Validate the request body.
    let body: z.infer<typeof botInstallSchema>;
    try {
      body = botInstallSchema.parse(await request.json());
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

    // 3. Check if a connection already exists for this conversation.
    const { data: existing } = await admin
      .from("messaging_connections")
      .select("id")
      .eq("org_id", auth.orgId)
      .eq("platform", "teams")
      .eq("channel_id", body.conversation_id)
      .maybeSingle();

    const connectionData = {
      org_id: auth.orgId,
      platform: "teams" as const,
      channel_id: body.conversation_id,
      channel_name: body.channel_name ?? "Teams Channel",
      workspace_id: body.team_id ?? body.tenant_id,
      workspace_name: body.team_name ?? null,
      webhook_url: body.service_url,
      is_active: true,
      installed_by: auth.user.id,
      // Bot installations don't use OAuth tokens -- they use the bot's
      // own credentials to send proactive messages via the service URL.
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      bot_token: null,
      notify_on_create: true,
      notify_on_decide: true,
      priority_filter: "all",
      routing_rules: {},
    };

    if (existing) {
      // 4a. Update existing connection.
      const { error: updateError } = await admin
        .from("messaging_connections")
        .update({
          webhook_url: body.service_url,
          workspace_id: body.team_id ?? body.tenant_id,
          workspace_name: body.team_name ?? null,
          channel_name: body.channel_name ?? "Teams Channel",
          is_active: true,
          installed_by: auth.user.id,
        })
        .eq("id", existing.id);

      if (updateError) {
        logger.error("[Teams Bot Install] Update failed:", updateError);
        throw new ApiError(500, "Failed to update Teams bot connection");
      }

      // Audit log
      await logAuditEvent({
        orgId: auth.orgId,
        userId: auth.user.id,
        action: "messaging_connection.updated",
        resourceType: "messaging_connection",
        resourceId: existing.id,
        ipAddress: getClientIp(request),
        details: {
          platform: "teams",
          conversation_id: body.conversation_id,
          service_url: body.service_url,
          team_name: body.team_name ?? null,
          channel_name: body.channel_name ?? null,
        },
      });

      return NextResponse.json({
        data: { id: existing.id, updated: true },
        message: "Teams bot connection updated successfully",
      });
    }

    // 4b. Create new connection.
    const { data: created, error: insertError } = await admin
      .from("messaging_connections")
      .insert(connectionData)
      .select("id")
      .single();

    if (insertError || !created) {
      logger.error("[Teams Bot Install] Insert failed:", insertError);
      throw new ApiError(500, "Failed to create Teams bot connection");
    }

    // Audit log
    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "messaging_connection.created",
      resourceType: "messaging_connection",
      resourceId: created.id,
      ipAddress: getClientIp(request),
      details: {
        platform: "teams",
        conversation_id: body.conversation_id,
        service_url: body.service_url,
        team_name: body.team_name ?? null,
        channel_name: body.channel_name ?? null,
      },
    });

    return NextResponse.json(
      {
        data: { id: created.id, updated: false },
        message: "Teams bot connection created successfully",
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
