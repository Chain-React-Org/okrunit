// ---------------------------------------------------------------------------
// OKrunit -- Microsoft Teams Notification Channel (Incoming Webhooks)
// ---------------------------------------------------------------------------
//
// Uses Incoming Webhooks with Adaptive Cards. Approve/reject actions use
// Action.OpenUrl buttons that link to one-click browser pages (no Azure Bot
// Service required). Tokens are generated using the same email_action_tokens
// table used by the email channel.
// ---------------------------------------------------------------------------

import { generateActionTokens } from "@/lib/notifications/tokens";
import { logger } from "@/lib/monitoring/logger";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamsNotificationParams {
  webhookUrl: string;
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  connectionName?: string;
  orgId: string;
}

export interface TeamsDecisionParams {
  webhookUrl: string;
  requestTitle: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map priority to a display label and Adaptive Card color. */
function priorityConfig(priority: string): {
  label: string;
  color: "attention" | "warning" | "good" | "default";
} {
  const map: Record<string, { label: string; color: "attention" | "warning" | "good" | "default" }> = {
    critical: { label: "Critical", color: "attention" },
    high: { label: "High", color: "attention" },
    medium: { label: "Medium", color: "warning" },
    low: { label: "Low", color: "good" },
  };
  return map[priority] ?? { label: priority, color: "default" };
}

/** Map a decision string to a Teams-friendly display string. */
function decisionDisplay(decision: string): string {
  const map: Record<string, string> = {
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return map[decision] ?? decision;
}

/**
 * Build the Adaptive Card body for a new approval request.
 *
 * Uses Action.OpenUrl buttons that open one-click approve/reject pages in the
 * browser. The tokens are single-use and expire after the configured TTL.
 */
function buildApprovalCard(
  params: TeamsNotificationParams,
  approveToken: string,
  rejectToken: string,
): object {
  const dashboardUrl = `${APP_URL}/dashboard#request-${params.requestId}`;
  const approveUrl = `${APP_URL}/approve/${approveToken}`;
  const rejectUrl = `${APP_URL}/reject/${rejectToken}`;
  const p = priorityConfig(params.priority);

  const bodyItems: object[] = [
    {
      type: "TextBlock",
      text: "New Approval Request",
      weight: "Bolder",
      size: "Large",
      wrap: true,
    },
    {
      type: "TextBlock",
      text: params.title,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
      spacing: "Small",
    },
  ];

  if (params.description) {
    bodyItems.push({
      type: "TextBlock",
      text: params.description,
      wrap: true,
      spacing: "Small",
      isSubtle: true,
    });
  }

  // Priority and Request ID in a ColumnSet
  const factColumns: object[] = [
    {
      type: "Column",
      width: "auto",
      items: [
        {
          type: "TextBlock",
          text: "Priority",
          weight: "Bolder",
          size: "Small",
          isSubtle: true,
        },
        {
          type: "TextBlock",
          text: p.label,
          color: p.color,
          weight: "Bolder",
          size: "Small",
        },
      ],
    },
    {
      type: "Column",
      width: "auto",
      spacing: "Large",
      items: [
        {
          type: "TextBlock",
          text: "Request ID",
          weight: "Bolder",
          size: "Small",
          isSubtle: true,
        },
        {
          type: "TextBlock",
          text: `${params.requestId.slice(0, 8)}...`,
          size: "Small",
          fontType: "Monospace",
        },
      ],
    },
  ];

  if (params.connectionName) {
    factColumns.push({
      type: "Column",
      width: "auto",
      spacing: "Large",
      items: [
        {
          type: "TextBlock",
          text: "Connection",
          weight: "Bolder",
          size: "Small",
          isSubtle: true,
        },
        {
          type: "TextBlock",
          text: params.connectionName,
          size: "Small",
        },
      ],
    });
  }

  bodyItems.push({
    type: "ColumnSet",
    columns: factColumns,
    spacing: "Medium",
  });

  // Browser action hint
  bodyItems.push({
    type: "TextBlock",
    text: "\uD83C\uDF10 Clicking Approve or Reject will open in your browser",
    size: "Small",
    color: "Accent",
    spacing: "Medium",
  });

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: bodyItems,
          actions: [
            {
              type: "Action.OpenUrl",
              title: "\u2705 Approve",
              url: approveUrl,
            },
            {
              type: "Action.OpenUrl",
              title: "\u274C Reject",
              url: rejectUrl,
            },
            {
              type: "Action.OpenUrl",
              title: "\uD83D\uDD0D View in Dashboard",
              url: dashboardUrl,
            },
          ],
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a Teams notification with an Adaptive Card containing approve/reject
 * links that open in the browser.
 *
 * Generates single-use tokens for the approve and reject actions using the
 * same email_action_tokens table used by the email channel. The token owner
 * is set to a synthetic "teams-org" user ID since Teams webhook notifications
 * are org-wide (not user-specific). The actual permission check happens when
 * the user confirms their action in the browser.
 *
 * Errors are caught and logged -- Teams notifications must never break the
 * main request flow.
 */
export async function sendTeamsNotification(
  params: TeamsNotificationParams,
): Promise<void> {
  try {
    // Generate one-time action tokens for the approve/reject links.
    // We use the orgId as a synthetic user ID since Teams webhooks are
    // org-wide channels -- the actual user identity is verified when they
    // open the link and confirm the action.
    const tokens = await generateActionTokens(
      params.requestId,
      params.orgId,
    );

    const payload = buildApprovalCard(params, tokens.approveToken, tokens.rejectToken);

    const response = await fetch(params.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[Teams] Webhook returned ${response.status} for request ${params.requestId}:`,
        body,
      );
      return;
    }

    logger.info(
      `[Teams] Notification sent for request ${params.requestId}`,
    );
  } catch (err) {
    logger.error("[Teams] Failed to send notification:", err);
  }
}

/**
 * Send a decision notification to Teams (simple message, no interactive
 * buttons).
 *
 * Errors are caught and logged -- Teams notifications must never break the
 * main request flow.
 */
export async function sendTeamsDecisionNotification(
  params: TeamsDecisionParams,
): Promise<void> {
  const decision = decisionDisplay(params.decision);
  const decidedByText = params.decidedBy
    ? ` by ${params.decidedBy}`
    : "";
  const commentText = params.comment
    ? `\n\n> _${params.comment}_`
    : "";

  const isApproved = params.decision === "approved";

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `${isApproved ? "\u2705" : "\u274C"} ${decision}: **${params.requestTitle}**${decidedByText}${commentText}`,
              wrap: true,
            },
          ],
        },
      },
    ],
  };

  try {
    const response = await fetch(params.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[Teams] Decision webhook returned ${response.status}:`,
        body,
      );
      return;
    }

    logger.info(
      `[Teams] Decision notification sent for "${params.requestTitle}"`,
    );
  } catch (err) {
    logger.error("[Teams] Failed to send decision notification:", err);
  }
}
