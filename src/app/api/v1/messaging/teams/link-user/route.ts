// ---------------------------------------------------------------------------
// OKrunit -- Teams user-identity OAuth start
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/teams/link-user
//
// Starts a lightweight OAuth flow that requests only the user scopes needed
// to read the caller's Microsoft Graph /me. Used by org members to link
// their Teams identity so inbound Approve/Reject clicks resolve to them.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";

const TEAMS_CLIENT_ID = process.env.TEAMS_CLIENT_ID!;
const TEAMS_TENANT_ID = process.env.TEAMS_TENANT_ID || "common";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// openid + profile + User.Read is enough to read /me and get the AAD object id.
const TEAMS_USER_SCOPES = ["openid", "profile", "User.Read", "offline_access"].join(" ");

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      return NextResponse.json({ error: "Session authentication required" }, { status: 401 });
    }

    if (!TEAMS_CLIENT_ID) {
      return NextResponse.json(
        { error: "Teams integration is not configured" },
        { status: 503 },
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({ orgId: auth.orgId, userId: auth.user.id, nonce, kind: "link" }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/messaging/teams/link-user/callback`;
    const authUrl = `https://login.microsoftonline.com/${TEAMS_TENANT_ID}/oauth2/v2.0/authorize`;

    const params = new URLSearchParams({
      client_id: TEAMS_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: TEAMS_USER_SCOPES,
      state,
    });

    return NextResponse.redirect(`${authUrl}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
