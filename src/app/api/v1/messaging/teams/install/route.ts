// ---------------------------------------------------------------------------
// OKrunit -- Microsoft Teams OAuth Install Route
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/teams/install
//
// Redirects the user to Microsoft's OAuth2 authorize URL to grant OKrunit
// permission to send messages to Teams channels.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";

const TEAMS_CLIENT_ID = process.env.TEAMS_CLIENT_ID!;
const TEAMS_TENANT_ID = process.env.TEAMS_TENANT_ID || "common";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const TEAMS_SCOPES = [
  "ChannelMessage.Send",
  "Channel.ReadBasic.All",
  "Team.ReadBasic.All",
  "offline_access",
].join(" ");

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    let userId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
      userId = auth.user.id;
    } else {
      return NextResponse.json(
        { error: "Session authentication required" },
        { status: 401 },
      );
    }

    if (!TEAMS_CLIENT_ID) {
      return NextResponse.json(
        { error: "Teams integration is not configured" },
        { status: 503 },
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({ orgId, nonce, userId }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/messaging/teams/callback`;
    const authUrl = `https://login.microsoftonline.com/${TEAMS_TENANT_ID}/oauth2/v2.0/authorize`;

    const params = new URLSearchParams({
      client_id: TEAMS_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: TEAMS_SCOPES,
      state,
      response_mode: "query",
    });

    return NextResponse.redirect(`${authUrl}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
