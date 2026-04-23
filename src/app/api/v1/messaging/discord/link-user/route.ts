// ---------------------------------------------------------------------------
// OKrunit -- Discord user-identity OAuth start
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/discord/link-user
//
// Starts a lightweight OAuth flow that requests only the "identify" scope
// needed to read the caller's Discord user id. Used by org members to link
// their Discord identity so inbound Approve/Reject clicks resolve to them.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      return NextResponse.json({ error: "Session authentication required" }, { status: 401 });
    }

    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json(
        { error: "Discord integration is not configured" },
        { status: 503 },
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({ orgId: auth.orgId, userId: auth.user.id, nonce, kind: "link" }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/messaging/discord/link-user/callback`;

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "identify",
      state,
    });

    return NextResponse.redirect(`${DISCORD_OAUTH_URL}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
