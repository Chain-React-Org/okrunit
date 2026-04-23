// ---------------------------------------------------------------------------
// OKrunit -- Discord user-identity OAuth callback
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/discord/link-user/callback
//
// Exchanges the code for a user token, calls /users/@me to pick up the
// caller's Discord user id, then upserts a messaging_user_identities row.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const settingsUrl = `${APP_URL}/requests/messaging`;
  const redirect = (query: string) => NextResponse.redirect(`${settingsUrl}?${query}`);

  if (errorParam) return redirect(`link_error=${encodeURIComponent(errorParam)}`);
  if (!code || !stateParam) return redirect("link_error=missing_params");

  let state: { orgId: string; userId: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    if (!state.orgId || !state.userId) throw new Error("bad state");
  } catch {
    return redirect("link_error=invalid_state");
  }

  try {
    const redirectUri = `${APP_URL}/api/v1/messaging/discord/link-user/callback`;
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      logger.error("[Discord LinkUser] Token exchange failed:", await tokenResponse.text());
      return redirect("link_error=token_exchange_failed");
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) return redirect("link_error=no_token");

    const meResp = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!meResp.ok) return redirect("link_error=me_failed");
    const me = (await meResp.json()) as { id?: string; username?: string };
    if (!me.id) return redirect("link_error=no_user_id");

    const admin = createAdminClient();
    const { error } = await admin
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
    if (error) {
      logger.error("[Discord LinkUser] Identity upsert failed:", error);
      return redirect("link_error=save_failed");
    }

    return redirect("linked=discord");
  } catch (err) {
    logger.error("[Discord LinkUser] Unexpected error:", err);
    return redirect("link_error=unexpected");
  }
}
