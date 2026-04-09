// ---------------------------------------------------------------------------
// OKrunit -- Slack OAuth Install Route
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/slack/install
//
// Redirects the user to Slack's OAuth2 v2 authorize URL to install the
// OKrunit app into their workspace.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SLACK_SCOPES = [
  "chat:write",
  "channels:read",
  "incoming-webhook",
].join(",");

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

    if (!SLACK_CLIENT_ID) {
      return NextResponse.json(
        { error: "Slack integration is not configured" },
        { status: 503 },
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({ orgId, nonce, userId }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/messaging/slack/callback`;

    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: SLACK_SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    return NextResponse.redirect(`${SLACK_OAUTH_URL}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
