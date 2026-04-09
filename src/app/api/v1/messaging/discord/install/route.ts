// ---------------------------------------------------------------------------
// OKrunit -- Discord OAuth Install Route
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/discord/install
//
// Redirects the user to Discord's OAuth2 authorize URL to add the OKrunit
// bot to their server. The state parameter encodes org_id for CSRF protection.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Bot permissions bitmap:
// Send Messages (0x800) + Embed Links (0x4000) + Use Slash Commands (0x80000000)
const BOT_PERMISSIONS = "2147485696";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
    } else {
      return NextResponse.json(
        { error: "Session authentication required" },
        { status: 401 },
      );
    }

    if (!DISCORD_CLIENT_ID) {
      return NextResponse.json(
        { error: "Discord integration is not configured" },
        { status: 503 },
      );
    }

    // Build state with org_id and a random nonce for CSRF protection
    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({ orgId, nonce, userId: auth.user.id }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/messaging/discord/callback`;

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "bot applications.commands",
      permissions: BOT_PERMISSIONS,
      state,
    });

    return NextResponse.redirect(`${DISCORD_OAUTH_URL}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
