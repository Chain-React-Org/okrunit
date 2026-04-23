// ---------------------------------------------------------------------------
// OKrunit -- Discord OAuth Callback Route
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/discord/callback
//
// Handles the OAuth2 callback from Discord after the user authorizes the bot.
// Exchanges the code for tokens, fetches guild info, and stores the connection.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";
import { redactForLogging } from "@/lib/monitoring/redact";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_API_BASE = "https://discord.com/api/v10";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  guild?: {
    id: string;
    name: string;
    icon: string | null;
  };
  webhook?: {
    url: string;
    channel_id: string;
  };
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

  // Handle user cancellation
  if (errorParam) {
    return NextResponse.redirect(`${redirectBase()}?error=${encodeURIComponent(errorParam)}`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${redirectBase()}?error=missing_params`);
  }

  // Decode and validate state
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
    // 1. Exchange authorization code for tokens
    const redirectUri = `${APP_URL}/api/v1/messaging/discord/callback`;

    const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
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
        // Not JSON — log the raw text but truncate to avoid stamping
        // a stray token in an error_description field.
        redactedBody = body.slice(0, 500);
      }
      logger.error("[Discord Callback] Token exchange failed:", redactedBody);
      return NextResponse.redirect(`${dest}?error=token_exchange_failed`);
    }

    const tokenData: DiscordTokenResponse = await tokenResponse.json();

    // 2. Get guild info from the token response (Discord includes it for bot flow)
    const guildId = tokenData.guild?.id;
    const guildName = tokenData.guild?.name;

    if (!guildId) {
      return NextResponse.redirect(`${dest}?error=no_guild_selected`);
    }

    // 3. Use a placeholder channel_id. User will select the real channel in the UI.
    //    Prefix with "pending:" so the orchestrator knows not to send to this.
    const defaultChannelId = `pending:${guildId}`;
    const defaultChannelName = guildName ?? "Server";

    // 4. Store the connection in the database
    const admin = createAdminClient();
    const tokenExpiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000,
    ).toISOString();

    const { data: connection, error: upsertError } = await admin
      .from("messaging_connections")
      .upsert(
        {
          org_id: state.orgId,
          platform: "discord",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: tokenExpiresAt,
          bot_token: tokenData.access_token,
          workspace_id: guildId,
          workspace_name: guildName ?? null,
          channel_id: defaultChannelId,
          channel_name: defaultChannelName,
          webhook_url: null,
          is_active: true,
          installed_by: state.userId,
        },
        { onConflict: "org_id,platform,channel_id" },
      )
      .select("id")
      .single();

    if (upsertError) {
      logger.error("[Discord Callback] Upsert failed:", upsertError);
      return NextResponse.redirect(`${dest}?error=save_failed`);
    }

    // 5. Seed messaging_user_identities with the installer's Discord user id
    // so button clicks from them resolve without a separate linking step.
    // Best-effort: Discord returns it via GET /users/@me with the user token.
    try {
      const meResp = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meResp.ok) {
        const me = (await meResp.json()) as { id?: string; username?: string };
        if (me.id) {
          const { error: identityError } = await admin
            .from("messaging_user_identities")
            .upsert(
              {
                org_id: state.orgId,
                user_id: state.userId,
                platform: "discord",
                external_user_id: me.id,
                external_username: me.username ?? null,
              },
              { onConflict: "org_id,platform,external_user_id" },
            );
          if (identityError) {
            logger.warn(
              `[Discord Callback] Failed to seed installer identity: ${identityError.message}`,
            );
          }
        }
      }
    } catch (err) {
      logger.warn("[Discord Callback] /users/@me lookup failed (non-fatal):", err);
    }

    // 6. Audit log
    logAuditEvent({
      orgId: state.orgId,
      userId: state.userId,
      action: "messaging_connection.created",
      resourceType: "messaging_connection",
      resourceId: connection?.id ?? undefined,
      ipAddress: getClientIp(request),
      details: {
        platform: "discord",
        guild_name: guildName,
        channel_id: defaultChannelId,
        channel_name: defaultChannelName,
      },
    });

    return NextResponse.redirect(`${dest}?success=discord`);
  } catch (error) {
    logger.error("[Discord Callback] Unexpected error:", error);
    return NextResponse.redirect(`${dest}?error=unexpected`);
  }
}
