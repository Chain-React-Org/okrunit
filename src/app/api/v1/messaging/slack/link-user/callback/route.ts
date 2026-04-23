// ---------------------------------------------------------------------------
// OKrunit -- Slack user-identity OAuth callback
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/slack/link-user/callback
//
// Completes the user-scope OAuth started at /api/v1/messaging/slack/link-user.
// Exchanges the code for an authed_user, then upserts the user's Slack id
// into messaging_user_identities so future Approve/Reject clicks resolve to
// them.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;
const SLACK_API_BASE = "https://slack.com/api";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SlackV2AccessResponse {
  ok: boolean;
  error?: string;
  authed_user?: {
    id: string;
    access_token?: string;
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const settingsUrl = `${APP_URL}/requests/messaging`;
  const redirect = (query: string) => NextResponse.redirect(`${settingsUrl}?${query}`);

  if (errorParam) return redirect(`link_error=${encodeURIComponent(errorParam)}`);
  if (!code || !stateParam) return redirect("link_error=missing_params");

  let state: { orgId: string; userId: string; kind?: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
    if (!state.orgId || !state.userId) throw new Error("bad state");
  } catch {
    return redirect("link_error=invalid_state");
  }

  try {
    const redirectUri = `${APP_URL}/api/v1/messaging/slack/link-user/callback`;
    const res = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = (await res.json()) as SlackV2AccessResponse;
    if (!data.ok || !data.authed_user?.id) {
      logger.error("[Slack LinkUser] Token exchange failed:", data.error);
      return redirect(`link_error=${encodeURIComponent(data.error ?? "slack_error")}`);
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("messaging_user_identities")
      .upsert(
        {
          org_id: state.orgId,
          user_id: state.userId,
          platform: "slack",
          external_user_id: data.authed_user.id,
          external_username: null,
        },
        { onConflict: "org_id,platform,external_user_id" },
      );
    if (error) {
      logger.error("[Slack LinkUser] Identity upsert failed:", error);
      return redirect("link_error=save_failed");
    }

    return redirect("linked=slack");
  } catch (err) {
    logger.error("[Slack LinkUser] Unexpected error:", err);
    return redirect("link_error=unexpected");
  }
}
