// ---------------------------------------------------------------------------
// OKrunit -- Teams user-identity OAuth callback
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/teams/link-user/callback
//
// Exchanges the code for an access token, calls Graph /me to pick up the
// AAD object id, then upserts a messaging_user_identities row so clicks
// from this user's Teams account resolve to their OKrunit account.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const TEAMS_CLIENT_ID = process.env.TEAMS_CLIENT_ID!;
const TEAMS_CLIENT_SECRET = process.env.TEAMS_CLIENT_SECRET!;
const TEAMS_TENANT_ID = process.env.TEAMS_TENANT_ID || "common";
const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
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
    const redirectUri = `${APP_URL}/api/v1/messaging/teams/link-user/callback`;
    const tokenUrl = `https://login.microsoftonline.com/${TEAMS_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: TEAMS_CLIENT_ID,
        client_secret: TEAMS_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      logger.error("[Teams LinkUser] Token exchange failed:", await tokenResponse.text());
      return redirect("link_error=token_exchange_failed");
    }
    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) return redirect("link_error=no_token");

    const meResp = await fetch(`${GRAPH_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!meResp.ok) {
      logger.error("[Teams LinkUser] /me failed:", await meResp.text());
      return redirect("link_error=me_failed");
    }
    const me = (await meResp.json()) as { id?: string; userPrincipalName?: string };
    if (!me.id) return redirect("link_error=no_user_id");

    const admin = createAdminClient();
    const { error } = await admin
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
    if (error) {
      logger.error("[Teams LinkUser] Identity upsert failed:", error);
      return redirect("link_error=save_failed");
    }

    return redirect("linked=teams");
  } catch (err) {
    logger.error("[Teams LinkUser] Unexpected error:", err);
    return redirect("link_error=unexpected");
  }
}
