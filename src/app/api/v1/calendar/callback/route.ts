// ---------------------------------------------------------------------------
// OKrunit -- Calendar OAuth: Callback
// ---------------------------------------------------------------------------
// GET: Handles the OAuth callback from Google or Microsoft, exchanges the
// authorization code for tokens, stores them, and redirects to settings.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/monitoring/capture";
import { logger } from "@/lib/monitoring/logger";

interface OAuthState {
  userId: string;
  orgId: string;
  provider: "google" | "microsoft";
  nonce: string;
}

// ---- Token exchange helpers -----------------------------------------------

async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  email: string | null;
}> {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/calendar/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();

  // Fetch calendar email from userinfo
  let email: string | null = null;
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      email = user.email ?? null;
    }
  } catch {
    // Non-critical, proceed without email
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_in: tokens.expires_in ?? 3600,
    email,
  };
}

async function exchangeMicrosoftCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  email: string | null;
}> {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/calendar/callback`;

  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        scope: "Calendars.Read offline_access",
      }),
    },
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();

  // Fetch user profile for email
  let email: string | null = null;
  try {
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      email = profile.mail ?? profile.userPrincipalName ?? null;
    }
  } catch {
    // Non-critical
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_in: tokens.expires_in ?? 3600,
    email,
  };
}

// ---- GET handler ----------------------------------------------------------

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const settingsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings`;

  if (errorParam) {
    return NextResponse.redirect(
      `${settingsUrl}?calendar_error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${settingsUrl}?calendar_error=missing_params`,
    );
  }

  let state: OAuthState;
  try {
    const decoded = Buffer.from(stateParam, "base64url").toString("utf-8");
    const envelope = JSON.parse(decoded);

    // Verify HMAC signature to prevent state forgery. Missing secret
    // is a hard error (not a silent fallback) so stolen DB credentials
    // can't double as state-signing keys.
    if (envelope.d && envelope.s) {
      const hmacKey = process.env.CALLBACK_HMAC_SECRET;
      if (!hmacKey) {
        return NextResponse.redirect(
          `${settingsUrl}?calendar_error=not_configured`,
        );
      }
      const expectedSig = createHmac("sha256", hmacKey).update(envelope.d).digest("hex").slice(0, 16);
      if (envelope.s !== expectedSig) {
        return NextResponse.redirect(
          `${settingsUrl}?calendar_error=invalid_state`,
        );
      }
      state = JSON.parse(envelope.d);
    } else {
      // Legacy unsigned state format
      state = envelope;
    }
  } catch {
    return NextResponse.redirect(
      `${settingsUrl}?calendar_error=invalid_state`,
    );
  }

  try {
    const tokens =
      state.provider === "google"
        ? await exchangeGoogleCode(code)
        : await exchangeMicrosoftCode(code);

    const admin = createAdminClient();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert the calendar connection (one per user+org+provider)
    const { error: upsertError } = await admin
      .from("calendar_connections")
      .upsert(
        {
          user_id: state.userId,
          org_id: state.orgId,
          provider: state.provider,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          calendar_email: tokens.email,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,org_id,provider" },
      );

    if (upsertError) {
      logger.error("[Calendar] Failed to store connection:", upsertError);
      return NextResponse.redirect(
        `${settingsUrl}?calendar_error=storage_failed`,
      );
    }

    return NextResponse.redirect(`${settingsUrl}?calendar_connected=${state.provider}`);
  } catch (err) {
    captureError({
      error: err instanceof Error ? err : new Error(String(err)),
      service: "calendar-callback",
      severity: "error",
    });
    return NextResponse.redirect(
      `${settingsUrl}?calendar_error=token_exchange_failed`,
    );
  }
}
