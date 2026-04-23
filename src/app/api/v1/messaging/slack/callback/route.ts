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
import { redactForLogging } from "@/lib/monitoring/redact";

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

  // Determine redirect base from state (if available)
  function redirectUrl(params: string): string {
    try {
      const s = stateParam ? JSON.parse(Buffer.from(stateParam, "base64url").toString()) : null;
      if (s?.from === "setup") return `${APP_URL}/setup?${params}`;
    } catch { /* fall through */ }
    return `${APP_URL}/requests/messaging?${params}`;
  }

  if (errorParam) {
    return NextResponse.redirect(redirectUrl(`error=${encodeURIComponent(errorParam)}`));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(redirectUrl("error=missing_params"));
  }

  let state: { orgId: string; nonce: string; userId: string; from?: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    if (!state.orgId || !state.userId) {
      throw new Error("Invalid state payload");
    }
  } catch {
    return NextResponse.redirect(redirectUrl("error=invalid_state"));
  }

  const dest = state.from === "setup" ? `${APP_URL}/setup` : `${APP_URL}/requests/messaging`;

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
      let redactedBody: unknown = body;
      try {
        redactedBody = redactForLogging(JSON.parse(body));
      } catch {
        redactedBody = body.slice(0, 500);
      }
      logger.error("[Slack Callback] Token exchange HTTP error:", redactedBody);
      return NextResponse.redirect(`${dest}?error=token_exchange_failed`);
    }

    const tokenData: SlackOAuthV2Response = await tokenResponse.json();

    if (!tokenData.ok) {
      logger.error("[Slack Callback] Slack API error:", tokenData.error);
      return NextResponse.redirect(`${dest}?error=${encodeURIComponent(tokenData.error ?? "slack_error")}`);
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
      return NextResponse.redirect(`${dest}?error=save_failed`);
    }

    // 4. Seed messaging_user_identities for the installer so their clicks
    // in Slack can immediately resolve to their OKrunit user id. Without
    // this the permission helper rejects every click with "link your
    // account". Other org members can be linked later via a dedicated UI.
    if (tokenData.authed_user?.id) {
      const { error: identityError } = await admin
        .from("messaging_user_identities")
        .upsert(
          {
            org_id: state.orgId,
            user_id: state.userId,
            platform: "slack",
            external_user_id: tokenData.authed_user.id,
            external_username: null,
          },
          { onConflict: "org_id,platform,external_user_id" },
        );
      if (identityError) {
        logger.warn(
          `[Slack Callback] Failed to seed installer identity: ${identityError.message}`,
        );
      }
    }

    // 5. Audit log
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

    return NextResponse.redirect(`${dest}?success=slack`);
  } catch (error) {
    logger.error("[Slack Callback] Unexpected error:", error);
    return NextResponse.redirect(`${dest}?error=unexpected`);
  }
}
