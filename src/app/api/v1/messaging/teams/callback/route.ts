// ---------------------------------------------------------------------------
// OKrunit -- Microsoft Teams OAuth Callback Route
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/teams/callback
//
// Handles the OAuth2 callback from Microsoft. Exchanges the code for tokens,
// fetches team/channel info, and stores the messaging connection.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

const TEAMS_CLIENT_ID = process.env.TEAMS_CLIENT_ID!;
const TEAMS_CLIENT_SECRET = process.env.TEAMS_CLIENT_SECRET!;
const TEAMS_TENANT_ID = process.env.TEAMS_TENANT_ID || "common";
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GraphTeam {
  id: string;
  displayName: string;
}

interface GraphChannel {
  id: string;
  displayName: string;
  membershipType: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Determine redirect base from state
  function redirectBase(): string {
    try {
      const s = stateParam ? JSON.parse(Buffer.from(stateParam, "base64url").toString()) : null;
      if (s?.from === "setup") return `${APP_URL}/setup`;
    } catch { /* fall through */ }
    return `${APP_URL}/requests/messaging`;
  }

  if (errorParam) {
    const errorDesc = url.searchParams.get("error_description") ?? errorParam;
    return NextResponse.redirect(`${redirectBase()}?error=${encodeURIComponent(errorDesc)}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${redirectBase()}?error=missing_params`);
  }

  let state: { orgId: string; nonce: string; userId: string; from?: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    if (!state.orgId || !state.userId) {
      throw new Error("Invalid state payload");
    }
  } catch {
    return NextResponse.redirect(`${redirectBase()}?error=invalid_state`);
  }

  const dest = state.from === "setup" ? `${APP_URL}/setup` : `${APP_URL}/requests/messaging`;

  try {
    // 1. Exchange code for tokens
    const redirectUri = `${APP_URL}/api/v1/messaging/teams/callback`;
    const tokenUrl = `https://login.microsoftonline.com/${TEAMS_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TEAMS_CLIENT_ID,
        client_secret: TEAMS_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: "ChannelMessage.Send Channel.ReadBasic.All Team.ReadBasic.All offline_access",
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      logger.error("[Teams Callback] Token exchange failed:", body);
      return NextResponse.redirect(
        `${dest}?error=token_exchange_failed`,
      );
    }

    const tokenData: MicrosoftTokenResponse = await tokenResponse.json();

    // 2. Fetch the user's joined teams
    const teamsResponse = await fetch(`${GRAPH_API_BASE}/me/joinedTeams`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    let teamId = "";
    let teamName = "";

    if (teamsResponse.ok) {
      const teamsData: { value: GraphTeam[] } = await teamsResponse.json();
      if (teamsData.value.length > 0) {
        // Use the first team by default; users can change this later
        teamId = teamsData.value[0].id;
        teamName = teamsData.value[0].displayName;
      }
    }

    // 3. Fetch channels for the team
    let channelId = "general";
    let channelName = "General";

    if (teamId) {
      const channelsResponse = await fetch(
        `${GRAPH_API_BASE}/teams/${teamId}/channels`,
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (channelsResponse.ok) {
        const channelsData: { value: GraphChannel[] } =
          await channelsResponse.json();
        // Prefer the General channel
        const generalChannel = channelsData.value.find(
          (c) => c.displayName === "General",
        );
        const firstChannel = generalChannel ?? channelsData.value[0];
        if (firstChannel) {
          channelId = firstChannel.id;
          channelName = firstChannel.displayName;
        }
      }
    }

    // 4. Build a webhook URL for the Teams connector (Graph API endpoint)
    // Teams doesn't use traditional webhook URLs -- messages are sent via
    // the Graph API with the stored access_token.
    const webhookUrl = teamId
      ? `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages`
      : null;

    // 5. Store the connection
    const admin = createAdminClient();
    const tokenExpiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000,
    ).toISOString();

    const { data: teamsConnection, error: upsertError } = await admin
      .from("messaging_connections")
      .upsert(
        {
          org_id: state.orgId,
          platform: "teams",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: tokenExpiresAt,
          bot_token: null,
          workspace_id: teamId || null,
          workspace_name: teamName || null,
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
      logger.error("[Teams Callback] Upsert failed:", upsertError);
      return NextResponse.redirect(
        `${dest}?error=save_failed`,
      );
    }

    // 6. Seed messaging_user_identities with the installer's AAD object id
    // so clicks in Teams can resolve to their OKrunit user without a
    // separate linking step. Best-effort — if the Graph /me call fails we
    // still proceed with the connection.
    try {
      const meResp = await fetch(`${GRAPH_API_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meResp.ok) {
        const me = (await meResp.json()) as {
          id?: string;
          userPrincipalName?: string;
        };
        if (me.id) {
          const { error: identityError } = await admin
            .from("messaging_user_identities")
            .upsert(
              {
                org_id: state.orgId,
                user_id: state.userId,
                platform: "teams",
                external_user_id: me.id,
                external_username: me.userPrincipalName ?? null,
              },
              { onConflict: "org_id,platform,external_user_id" },
            );
          if (identityError) {
            logger.warn(
              `[Teams Callback] Failed to seed installer identity: ${identityError.message}`,
            );
          }
        }
      }
    } catch (err) {
      logger.warn("[Teams Callback] /me lookup failed (non-fatal):", err);
    }

    // 7. Audit log
    logAuditEvent({
      orgId: state.orgId,
      userId: state.userId,
      action: "messaging_connection.created",
      resourceType: "messaging_connection",
      resourceId: teamsConnection?.id ?? undefined,
      ipAddress: getClientIp(request),
      details: {
        platform: "teams",
        team_name: teamName,
        channel_id: channelId,
        channel_name: channelName,
      },
    });

    return NextResponse.redirect(
      `${dest}?success=teams`,
    );
  } catch (error) {
    logger.error("[Teams Callback] Unexpected error:", error);
    return NextResponse.redirect(
      `${dest}?error=unexpected`,
    );
  }
}
