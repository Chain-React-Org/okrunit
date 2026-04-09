// ---------------------------------------------------------------------------
// OKrunit -- monday.com OAuth Install Route
// ---------------------------------------------------------------------------
// GET /api/v1/monday/install
//
// Redirects the user to monday.com's OAuth2 authorize URL to install the
// OKrunit app into their monday.com account.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse } from "@/lib/api/errors";
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID!;
const MONDAY_OAUTH_URL = "https://auth.monday.com/oauth2/authorize";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

    if (!MONDAY_CLIENT_ID) {
      return NextResponse.json(
        { error: "monday.com integration is not configured" },
        { status: 503 },
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = Buffer.from(
      JSON.stringify({ orgId, nonce, userId }),
    ).toString("base64url");

    const redirectUri = `${APP_URL}/api/v1/monday/callback`;

    const params = new URLSearchParams({
      client_id: MONDAY_CLIENT_ID,
      redirect_uri: redirectUri,
      state,
    });

    return NextResponse.redirect(`${MONDAY_OAUTH_URL}?${params.toString()}`);
  } catch (error) {
    return errorResponse(error);
  }
}
