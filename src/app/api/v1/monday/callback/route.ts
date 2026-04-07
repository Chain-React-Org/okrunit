// ---------------------------------------------------------------------------
// OKrunit -- monday.com OAuth Callback Route
// ---------------------------------------------------------------------------
// GET /api/v1/monday/callback
//
// Handles the OAuth2 callback from monday.com. Exchanges the authorization
// code for an access token and stores the connection for the organization.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";

const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID!;
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET!;
const MONDAY_TOKEN_URL = "https://auth.monday.com/oauth2/token";
const MONDAY_API_URL = "https://api.monday.com/v2";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface MondayTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface MondayMeResponse {
  data: {
    me: {
      id: number;
      name: string;
      email: string;
      account: {
        id: number;
        name: string;
      };
    };
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

  if (!code) {
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=missing_params`,
    );
  }

  // State is optional for monday.com OAuth but we use it to track org/user
  let state: { orgId: string; nonce: string; userId: string } | null = null;
  if (stateParam) {
    try {
      state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
      if (!state?.orgId || !state?.userId) {
        state = null;
      }
    } catch {
      // State parsing failed - continue without it
    }
  }

  if (!state) {
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=invalid_state`,
    );
  }

  try {
    // 1. Exchange code for access token
    const redirectUri = `${APP_URL}/api/v1/monday/callback`;

    const tokenResponse = await fetch(MONDAY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MONDAY_CLIENT_ID,
        client_secret: MONDAY_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error("[monday.com Callback] Token exchange HTTP error:", body);
      return NextResponse.redirect(
        `${APP_URL}/requests/messaging?error=token_exchange_failed`,
      );
    }

    const tokenData: MondayTokenResponse = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error("[monday.com Callback] No access token in response");
      return NextResponse.redirect(
        `${APP_URL}/requests/messaging?error=no_access_token`,
      );
    }

    // 2. Fetch account info via monday.com GraphQL API
    const meResponse = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: tokenData.access_token,
      },
      body: JSON.stringify({
        query: "{ me { id name email account { id name } } }",
      }),
    });

    const meData: MondayMeResponse = await meResponse.json();
    const account = meData.data?.me?.account;
    const user = meData.data?.me;

    const workspaceId = account?.id?.toString() ?? "unknown";
    const workspaceName = account?.name ?? "monday.com";

    // 3. Store the connection
    const admin = createAdminClient();

    const { data: mondayConnection, error: upsertError } = await admin
      .from("messaging_connections")
      .upsert(
        {
          org_id: state.orgId,
          platform: "monday" as never,
          access_token: tokenData.access_token,
          refresh_token: null, // monday.com tokens don't expire
          token_expires_at: null,
          bot_token: null,
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          channel_id: "default",
          channel_name: "default",
          webhook_url: null,
          is_active: true,
          installed_by: state.userId,
        },
        { onConflict: "org_id,platform,channel_id" },
      )
      .select("id")
      .single();

    if (upsertError) {
      console.error("[monday.com Callback] Upsert failed:", upsertError);
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
      resourceId: mondayConnection?.id ?? undefined,
      ipAddress: getClientIp(request),
      details: {
        platform: "monday",
        workspace_name: workspaceName,
        monday_user_id: user?.id,
        monday_user_name: user?.name,
      },
    });

    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?success=monday`,
    );
  } catch (error) {
    console.error("[monday.com Callback] Unexpected error:", error);
    return NextResponse.redirect(
      `${APP_URL}/requests/messaging?error=unexpected`,
    );
  }
}
