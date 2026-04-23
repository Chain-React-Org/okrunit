// ---------------------------------------------------------------------------
// OKrunit -- Slack user-identity OAuth start
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/slack/link-user
//
// Starts a lightweight OAuth flow that requests only the user_scope needed
// to read the caller's Slack user id. Used by non-installer org members to
// link their Slack identity so messaging-app Approve/Reject clicks resolve
// to them. The full app install flow lives at /api/v1/messaging/slack/install.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Only request user scopes — we do NOT need bot capability here, just the
// caller's Slack user id. identity.basic is the smallest scope that gives
// us authed_user.id back.
const SLACK_USER_SCOPES = ["identity.basic"].join(",");

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
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
      JSON.stringify({ orgId: auth.orgId, userId: auth.user.id, nonce, kind: "link" }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/messaging/slack/link-user/callback`;

    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      user_scope: SLACK_USER_SCOPES,
      redirect_uri: redirectUri,
      state,
    });

    return NextResponse.redirect(`${SLACK_OAUTH_URL}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
