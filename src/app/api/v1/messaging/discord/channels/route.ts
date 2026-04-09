// ---------------------------------------------------------------------------
// OKrunit -- List Discord Guild Channels
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/discord/channels?connection_id=xxx
//
// Returns text channels for the guild associated with a Discord connection,
// so the user can pick which channel to send notifications to.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      throw new ApiError(401, "Session required");
    }

    const url = new URL(request.url);
    const connectionId = url.searchParams.get("connection_id");
    if (!connectionId) {
      throw new ApiError(400, "Missing connection_id");
    }

    const admin = createAdminClient();
    const { data: connection } = await admin
      .from("messaging_connections")
      .select("id, org_id, platform, bot_token, workspace_id")
      .eq("id", connectionId)
      .eq("org_id", auth.orgId)
      .eq("platform", "discord")
      .single();

    if (!connection) {
      throw new ApiError(404, "Discord connection not found");
    }

    if (!connection.workspace_id) {
      throw new ApiError(400, "Missing guild ID");
    }

    // Get a valid token (refreshes if needed, prefers DISCORD_BOT_TOKEN env)
    const { ensureDiscordToken } = await import("@/lib/notifications/token-refresh");
    const fullConn = await (async () => {
      const admin2 = createAdminClient();
      const { data } = await admin2
        .from("messaging_connections")
        .select("*")
        .eq("id", connectionId)
        .single();
      return data;
    })();

    const botToken = fullConn ? await ensureDiscordToken(fullConn) : null;
    if (!botToken) {
      throw new ApiError(400, "No valid bot token. Set DISCORD_BOT_TOKEN in environment or reconnect Discord.");
    }

    const response = await fetch(
      `${DISCORD_API_BASE}/guilds/${connection.workspace_id}/channels`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("[Discord Channels] API error:", response.status, body);
      throw new ApiError(502, "Failed to fetch Discord channels");
    }

    const allChannels: Array<{ id: string; name: string; type: number; position: number }> = await response.json();

    // Only return text channels (type 0) sorted by position
    const textChannels = allChannels
      .filter((c) => c.type === 0)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name }));

    return NextResponse.json({ channels: textChannels });
  } catch (err) {
    return errorResponse(err);
  }
}
