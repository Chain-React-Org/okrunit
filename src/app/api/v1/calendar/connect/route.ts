// ---------------------------------------------------------------------------
// OKrunit -- Calendar OAuth: Initiate Connection
// ---------------------------------------------------------------------------
// POST: Initiates OAuth flow for Google Calendar or Microsoft Graph.
// Returns the authorization URL the client should redirect to.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";

const bodySchema = z.object({
  provider: z.enum(["google", "microsoft"]),
});

// ---- Google Calendar OAuth URLs -------------------------------------------

function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) {
    throw new ApiError(500, "Google Calendar integration is not configured");
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/calendar/callback`;
  const scopes = "https://www.googleapis.com/auth/calendar.readonly";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ---- Microsoft Calendar OAuth URLs ----------------------------------------

function buildMicrosoftAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  if (!clientId) {
    throw new ApiError(500, "Microsoft Calendar integration is not configured");
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/calendar/callback`;
  const scopes = "Calendars.Read offline_access";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

// ---- POST handler ---------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { provider } = parsed.data;

    // Encode user context into the OAuth state parameter so the callback
    // can associate the token with the correct user and org.
    const statePayload = JSON.stringify({
      userId: auth.user.id,
      orgId: auth.orgId,
      provider,
      nonce: randomBytes(16).toString("hex"),
    });
    const state = Buffer.from(statePayload).toString("base64url");

    const redirectUrl =
      provider === "google"
        ? buildGoogleAuthUrl(state)
        : buildMicrosoftAuthUrl(state);

    return NextResponse.json({ redirect_url: redirectUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
