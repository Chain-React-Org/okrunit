// ---------------------------------------------------------------------------
// OKrunit -- Tweet Draft Approval Notifications
// ---------------------------------------------------------------------------
// Sends a "draft tweet ready for review" message to one or more messaging
// connections. The message contains the draft text, theme, scheduled time,
// and a link to the edit page where the founder can approve, edit, or reject.
// ---------------------------------------------------------------------------

import { logger } from "@/lib/monitoring/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MessagingConnection } from "@/lib/types/database";
import type { TweetDraft } from "@/lib/tweets/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const THEME_LABEL: Record<string, string> = {
  feature: "Feature drop",
  lesson: "Lesson / hot take",
  use_case: "Use case",
  milestone: "Milestone",
};

function buildMessage(draft: TweetDraft): string {
  const editUrl = `${APP_URL}/admin/tweets/${draft.id}`;
  const scheduled = new Date(draft.scheduled_for).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const themeLabel = THEME_LABEL[draft.theme] ?? draft.theme;
  return [
    `Draft tweet ready for review (${themeLabel})`,
    `Scheduled: ${scheduled}`,
    "",
    draft.content,
    "",
    `Review / edit / approve: ${editUrl}`,
    `Characters: ${draft.content.length}/280`,
  ].join("\n");
}

async function sendSlackMessage(
  conn: MessagingConnection,
  text: string,
): Promise<void> {
  const botToken = conn.bot_token;
  const channelId = conn.channel_id;
  const webhookUrl = conn.webhook_url;

  if (botToken && channelId) {
    const resp = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({ channel: channelId, text }),
    });
    const data = (await resp.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      throw new Error(`Slack chat.postMessage failed: ${data.error ?? "unknown"}`);
    }
    return;
  }

  if (webhookUrl) {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      throw new Error(`Slack webhook failed: ${resp.status}`);
    }
    return;
  }

  throw new Error("Slack connection has no bot token or webhook URL");
}

async function sendDiscordMessage(
  conn: MessagingConnection,
  text: string,
): Promise<void> {
  const webhookUrl = conn.webhook_url;
  if (webhookUrl) {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (!resp.ok) {
      throw new Error(`Discord webhook failed: ${resp.status}`);
    }
    return;
  }

  const botToken = conn.bot_token ?? process.env.DISCORD_BOT_TOKEN;
  const channelId = conn.channel_id;
  if (botToken && channelId && !channelId.startsWith("pending:")) {
    const resp = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({ content: text }),
      },
    );
    if (!resp.ok) {
      throw new Error(`Discord bot post failed: ${resp.status}`);
    }
    return;
  }

  throw new Error("Discord connection has no usable delivery method");
}

async function sendTelegramMessage(
  conn: MessagingConnection,
  text: string,
): Promise<void> {
  const botToken = conn.bot_token ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = conn.channel_id;
  if (!botToken) throw new Error("Telegram bot token missing");
  if (!chatId) throw new Error("Telegram chat id missing");

  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Telegram sendMessage failed: ${resp.status} ${body}`);
  }
}

async function sendTeamsMessage(
  conn: MessagingConnection,
  text: string,
): Promise<void> {
  const webhookUrl = conn.webhook_url;
  if (!webhookUrl) throw new Error("Teams connection has no webhook URL");
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    throw new Error(`Teams webhook failed: ${resp.status}`);
  }
}

async function dispatchOne(
  conn: MessagingConnection,
  text: string,
): Promise<void> {
  switch (conn.platform) {
    case "slack":
      return sendSlackMessage(conn, text);
    case "discord":
      return sendDiscordMessage(conn, text);
    case "telegram":
      return sendTelegramMessage(conn, text);
    case "teams":
      return sendTeamsMessage(conn, text);
    default:
      throw new Error(`Unsupported platform: ${conn.platform}`);
  }
}

/**
 * Resolve which messaging connections to ping for tweet approval.
 * Empty notifyConnectionIds means no notifications. The founder must
 * explicitly opt in by selecting channels in /admin/tweets/config.
 */
async function resolveTargetConnections(
  notifyConnectionIds: string[],
): Promise<MessagingConnection[]> {
  if (notifyConnectionIds.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messaging_connections")
    .select("*")
    .eq("is_active", true)
    .in("id", notifyConnectionIds)
    .returns<MessagingConnection[]>();
  if (error) {
    logger.error("[Tweets] Failed to load messaging connections:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Send a draft tweet to all configured messaging connections for review.
 * Never throws. Each per-channel failure is logged.
 */
export async function notifyDraftReady(
  draft: TweetDraft,
  notifyConnectionIds: string[],
): Promise<{ sent: number; failed: number }> {
  const connections = await resolveTargetConnections(notifyConnectionIds);
  if (connections.length === 0) {
    logger.error(
      "[Tweets] No messaging connections available for draft notification",
    );
    return { sent: 0, failed: 0 };
  }

  const text = buildMessage(draft);
  const results = await Promise.allSettled(
    connections.map((conn) => dispatchOne(conn, text)),
  );

  let sent = 0;
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      logger.error(
        `[Tweets] Notify failed for ${connections[i].platform} (${connections[i].id}):`,
        r.reason,
      );
    }
  });
  return { sent, failed };
}
