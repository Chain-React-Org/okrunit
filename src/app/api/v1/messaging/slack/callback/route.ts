// ---------------------------------------------------------------------------
// OKrunit -- Slack OAuth Callback Route
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/slack/callback
//
// Handles the OAuth2 v2 callback from Slack. Exchanges the code for tokens,
// extracts workspace and channel info, and stores the messaging connection.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const SLACK_API_BASE = "https://slack.com/api";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SlackOAuthV2Response {
  ok: boolean;
  error?: string;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  authed_user?: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=missing_params`,
    );
  }

  let state: { orgId: string; nonce: string; userId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    if (!state.orgId || !state.userId) {
      throw new Error("Invalid state payload");
    }
  } catch {
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=invalid_state`,
    );
  }

  try {
    // 1. Exchange code for access token
    const redirectUri = `${APP_URL}/api/v1/messaging/slack/callback`;

    const tokenResponse = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      logger.error("[Slack Callback] Token exchange HTTP error:", body);
      return NextResponse.redirect(
        `${APP_URL}/requests/messaging?error=token_exchange_failed`,
      );
    }

    const tokenData: SlackOAuthV2Response = await tokenResponse.json();

    if (!tokenData.ok) {
      logger.error("[Slack Callback] Slack API error:", tokenData.error);
      return NextResponse.redirect(
        `${APP_URL}/requests/messaging?error=${encodeURIComponent(tokenData.error ?? "slack_error")}`,
      );
    }

    // 2. Extract workspace and channel info
    const workspaceId = tokenData.team.id;
    const workspaceName = tokenData.team.name;
    const channelId =
      tokenData.incoming_webhook?.channel_id ?? "default";
    const channelName =
      tokenData.incoming_webhook?.channel ?? "default";
    const webhookUrl = tokenData.incoming_webhook?.url ?? null;

    // 3. Store the connection
    const admin = createAdminClient();

    const { data: slackConnection, error: upsertError } = await admin
      .from("messaging_connections")
      .upsert(
        {
          org_id: state.orgId,
          platform: "slack",
          access_token: tokenData.access_token,
          refresh_token: null, // Slack v2 tokens don't expire
          token_expires_at: null,
          bot_token: tokenData.access_token,
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          channel_id: channelId,
          channel_name: channelName,
          webhook_url: webhookUrl,
          is_active: true,
          installed_by: state.userId,
        },
        { onConflict: "org_id,platform,channel_id" },
      )
      .select("id")
      .single();

    if (upsertError) {
      logger.error("[Slack Callback] Upsert failed:", upsertError);
      return NextResponse.redirect(
        `${APP_URL}/requests/messaging?error=save_failed`,
      );
    }

    // 4. Audit log
    logAuditEvent({
      orgId: state.orgId,
      userId: state.userId,
      action: "messaging_connection.created",
      resourceType: "messaging_connection",
      resourceId: slackConnection?.id ?? undefined,
      ipAddress: getClientIp(request),
      details: {
        platform: "slack",
        workspace_name: workspaceName,
        channel_id: channelId,
        channel_name: channelName,
      },
    });

    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?success=slack`,
    );
  } catch (error) {
    logger.error("[Slack Callback] Unexpected error:", error);
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=unexpected`,
    );
  }
}
