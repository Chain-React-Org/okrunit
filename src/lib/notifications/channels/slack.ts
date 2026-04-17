// ---------------------------------------------------------------------------
// OKrunit -- Slack Notification Channel (Block Kit via Incoming Webhooks)
// ---------------------------------------------------------------------------

import { logger } from "@/lib/monitoring/logger";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackNotificationParams {
  webhookUrl: string;
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  connectionName?: string;
}

export interface SlackDecisionParams {
  webhookUrl: string;
  requestTitle: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}

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
  };
  return map[decision] ?? decision;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a Slack notification with Block Kit layout containing approve/reject
 * buttons.
 *
 * The buttons use Slack interactive messages, which require a separate
 * callback endpoint (`/api/slack/interact`) to receive the user's response.
 * The `action_id` encodes the request ID and action so the callback handler
 * knows what to do.
 *
 * Errors are caught and logged -- Slack notifications must never break the
 * main request flow.
 */
export async function sendSlackNotification(
  params: SlackNotificationParams,
): Promise<void> {
  const dashboardUrl = `${APP_URL}/dashboard#request-${params.requestId}`;

  const descriptionField = params.description
    ? `\n>${params.description}`
    : "";

  const connectionField = params.connectionName
    ? `\n*Connection:* ${params.connectionName}`
    : "";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "New Approval Request",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${params.title}*${descriptionField}`,
      },
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
          text: {
            type: "plain_text",
            text: "Approve",
            emoji: true,
          },
          style: "primary",
          action_id: `okrunit_approve`,
          value: params.requestId,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Reject",
            emoji: true,
          },
          style: "danger",
          action_id: `okrunit_reject`,
          value: params.requestId,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View in Dashboard",
            emoji: true,
          },
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
      return;
    }

    logger.info(
      `[Slack] Notification sent for request ${params.requestId}`,
    );
  } catch (err) {
    logger.error("[Slack] Failed to send notification:", err);
  }
}

/**
 * Send a decision notification to Slack (simple message, no interactive
 * buttons).
 *
 * Errors are caught and logged -- Slack notifications must never break the
 * main request flow.
 */
export async function sendSlackDecisionNotification(
  params: SlackDecisionParams,
): Promise<void> {
  const decidedByText = params.decidedBy
    ? ` by ${params.decidedBy}`
    : "";

  const commentText = params.comment
    ? `\n>_${params.comment}_`
    : "";

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${decisionDisplay(params.decision)} *${params.requestTitle}*${decidedByText}${commentText}`,
      },
    },
  ];

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
