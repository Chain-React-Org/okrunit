// ---------------------------------------------------------------------------
// OKrunit -- Slack Notification Channel
// ---------------------------------------------------------------------------
// Posts approval-request cards and decision notifications to Slack. When the
// connection has a bot token (from the chat:write OAuth scope) we prefer
// chat.postMessage so we can capture the message ts and later edit the card
// in place via chat.update. Legacy installs that only have an
// Incoming Webhook URL still work via the webhook POST fallback, but those
// messages cannot be edited after a decision.
// ---------------------------------------------------------------------------

import { logger } from "@/lib/monitoring/logger";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SLACK_API_BASE = "https://slack.com/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackNotificationParams {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  connectionName?: string;
}

export interface SlackMessageRef {
  channelId: string;
  ts: string;
}

export interface SlackDecisionParams {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  requestTitle: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}

type SlackBlock = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map priority to a Slack emoji and display string. */
function priorityEmoji(priority: string): string {
  const map: Record<string, string> = {
    critical: ":rotating_light: Critical",
    high: ":red_circle: High",
    medium: ":large_orange_circle: Medium",
    low: ":large_green_circle: Low",
  };
  return map[priority] ?? `:white_circle: ${priority}`;
}

/** Map a decision string to a Slack-friendly display string. */
function decisionDisplay(decision: string): string {
  const map: Record<string, string> = {
    approved: ":white_check_mark: Approved",
    rejected: ":x: Rejected",
    cancelled: ":no_entry_sign: Cancelled",
    expired: ":hourglass: Expired",
  };
  return map[decision] ?? decision;
}

function buildRequestBlocks(params: {
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  connectionName?: string;
}): SlackBlock[] {
  const dashboardUrl = `${APP_URL}/dashboard#request-${params.requestId}`;
  const descriptionField = params.description ? `\n>${params.description}` : "";
  const connectionField = params.connectionName
    ? `\n*Connection:* ${params.connectionName}`
    : "";

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "New Approval Request", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${params.title}*${descriptionField}` },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Priority:*\n${priorityEmoji(params.priority)}`,
        },
        {
          type: "mrkdwn",
          text: `*Request ID:*\n\`${params.requestId.slice(0, 8)}...\``,
        },
        ...(params.connectionName
          ? [
              {
                type: "mrkdwn",
                text: `*Connection:*\n${params.connectionName}`,
              },
            ]
          : []),
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve", emoji: true },
          style: "primary",
          action_id: "okrunit_approve",
          value: params.requestId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject", emoji: true },
          style: "danger",
          action_id: "okrunit_reject",
          value: params.requestId,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "View in Dashboard", emoji: true },
          url: dashboardUrl,
          action_id: "okrunit_view",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Sent by OKrunit${connectionField}`,
        },
      ],
    },
  ];
}

function buildDecisionBlocks(params: {
  title: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}): SlackBlock[] {
  const decidedByText = params.decidedBy ? ` by ${params.decidedBy}` : "";
  const commentText = params.comment ? `\n>_${params.comment}_` : "";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${decisionDisplay(params.decision)} *${params.title}*${decidedByText}${commentText}`,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Bot-token API calls (chat.postMessage / chat.update)
// ---------------------------------------------------------------------------

async function callSlackApi<T>(
  method: string,
  botToken: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const resp = await fetch(`${SLACK_API_BASE}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as { ok: boolean; error?: string } & T;
    if (!data.ok) {
      logger.error(`[Slack] ${method} failed: ${data.error ?? "unknown"}`);
      return null;
    }
    return data;
  } catch (err) {
    logger.error(`[Slack] ${method} threw:`, err);
    return null;
  }
}

export async function postSlackBotMessage(params: {
  botToken: string;
  channelId: string;
  blocks: SlackBlock[];
  text: string;
}): Promise<SlackMessageRef | null> {
  const result = await callSlackApi<{ ts?: string; channel?: string }>(
    "chat.postMessage",
    params.botToken,
    {
      channel: params.channelId,
      blocks: params.blocks,
      text: params.text,
    },
  );
  if (!result?.ts || !result.channel) return null;
  return { channelId: result.channel, ts: result.ts };
}

export async function updateSlackBotMessage(params: {
  botToken: string;
  channelId: string;
  ts: string;
  title: string;
  decision: "approved" | "rejected" | "cancelled" | "expired";
  decidedBy?: string;
  comment?: string;
}): Promise<void> {
  const blocks = buildDecisionBlocks({
    title: params.title,
    decision: params.decision,
    decidedBy: params.decidedBy,
    comment: params.comment,
  });
  await callSlackApi("chat.update", params.botToken, {
    channel: params.channelId,
    ts: params.ts,
    blocks,
    text: `${decisionDisplay(params.decision).replace(/^:[^:]+:\s*/, "")}: ${params.title}`,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an approval-request card to Slack. Prefers bot-token chat.postMessage
 * (returns a message ref we can edit later); falls back to the Incoming
 * Webhook URL for connections that don't have a bot token.
 */
export async function sendSlackNotification(
  params: SlackNotificationParams,
): Promise<SlackMessageRef | null> {
  const blocks = buildRequestBlocks({
    requestId: params.requestId,
    title: params.title,
    description: params.description,
    priority: params.priority,
    connectionName: params.connectionName,
  });

  if (params.botToken && params.channelId) {
    const ref = await postSlackBotMessage({
      botToken: params.botToken,
      channelId: params.channelId,
      blocks,
      text: `New Approval Request: ${params.title}`,
    });
    if (ref) {
      logger.info(
        `[Slack] Notification sent via bot for request ${params.requestId}`,
      );
    }
    return ref;
  }

  if (!params.webhookUrl) {
    logger.error(
      `[Slack] No delivery method (bot token or webhook) for request ${params.requestId}`,
    );
    return null;
  }

  try {
    const response = await fetch(params.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[Slack] Webhook returned ${response.status} for request ${params.requestId}:`,
        body,
      );
      return null;
    }

    logger.info(
      `[Slack] Notification sent via webhook for request ${params.requestId}`,
    );
    return null;
  } catch (err) {
    logger.error("[Slack] Failed to send notification:", err);
    return null;
  }
}

/**
 * Send a decision notification to Slack (simple message, no interactive
 * buttons). Used for the secondary "X decided Y" follow-up post that lands
 * below the original card.
 */
export async function sendSlackDecisionNotification(
  params: SlackDecisionParams,
): Promise<void> {
  const blocks = buildDecisionBlocks({
    title: params.requestTitle,
    decision: params.decision,
    decidedBy: params.decidedBy,
    comment: params.comment,
  });

  if (params.botToken && params.channelId) {
    await callSlackApi("chat.postMessage", params.botToken, {
      channel: params.channelId,
      blocks,
      text: `${decisionDisplay(params.decision).replace(/^:[^:]+:\s*/, "")}: ${params.requestTitle}`,
    });
    return;
  }

  if (!params.webhookUrl) return;

  try {
    const response = await fetch(params.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[Slack] Decision webhook returned ${response.status}:`,
        body,
      );
      return;
    }

    logger.info(
      `[Slack] Decision notification sent for "${params.requestTitle}"`,
    );
  } catch (err) {
    logger.error("[Slack] Failed to send decision notification:", err);
  }
}
