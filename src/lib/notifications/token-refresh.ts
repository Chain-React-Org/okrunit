// ---------------------------------------------------------------------------
// OKrunit -- OAuth Token Refresh for Messaging Connections
// ---------------------------------------------------------------------------
// Checks if a connection's OAuth token is expired and refreshes it before use.
// Currently supports Discord. Teams uses webhook URLs (no token needed).
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import type { MessagingConnection } from "@/lib/types/database";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const REFRESH_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

/**
 * Ensure a Discord connection has a valid bot token.
 * If DISCORD_BOT_TOKEN env var is set, always use that (never expires).
 * Otherwise, check the OAuth token expiry and refresh if needed.
 * Returns the token to use for API calls.
 */
export async function ensureDiscordToken(
  conn: MessagingConnection,
): Promise<string | null> {
  // Prefer the dedicated bot token from env. It never expires
  const envBotToken = process.env.DISCORD_BOT_TOKEN;
  if (envBotToken) return envBotToken;

  // No stored token at all
  if (!conn.bot_token) return null;

  // Check if token is expired or about to expire
  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at).getTime();
    const now = Date.now();
    const bufferMs = REFRESH_BUFFER_SECONDS * 1000;

    if (now < expiresAt - bufferMs) {
      // Token still valid
      return conn.bot_token;
    }

    // Token expired or about to expire - try refresh
    if (conn.refresh_token) {
      const refreshed = await refreshDiscordToken(conn);
      if (refreshed) return refreshed;
    }
  }

  // No expiry info. Assume valid (backwards compat)
  return conn.bot_token;
}

async function refreshDiscordToken(
  conn: MessagingConnection,
): Promise<string | null> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret || !conn.refresh_token) {
    console.warn("[Token Refresh] Missing Discord credentials for refresh");
    return null;
  }

  try {
    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: conn.refresh_token,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[Token Refresh] Discord refresh failed:", response.status, body);
      return null;
    }

    const data: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    } = await response.json();

    // Update stored tokens in database
    const admin = createAdminClient();
    const tokenExpiresAt = new Date(
      Date.now() + data.expires_in * 1000,
    ).toISOString();

    await admin
      .from("messaging_connections")
      .update({
        access_token: data.access_token,
        bot_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expires_at: tokenExpiresAt,
      })
      .eq("id", conn.id);

    console.log("[Token Refresh] Discord token refreshed for connection:", conn.id);
    return data.access_token;
  } catch (err) {
    console.error("[Token Refresh] Discord refresh error:", err);
    return null;
  }
}
