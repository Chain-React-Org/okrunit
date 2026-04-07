// ---------------------------------------------------------------------------
// OKrunit -- Discord Notification Channel (Webhook Embeds + Buttons)
// ---------------------------------------------------------------------------

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscordNotificationParams {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  connectionName?: string;
}

export interface DiscordDecisionParams {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  requestTitle: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Discord API Types (subset)
// ---------------------------------------------------------------------------

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordButtonComponent {
  type: 2; // Button
  style: 1 | 2 | 3 | 4 | 5; // Primary, Secondary, Success, Danger, Link
  label: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
}

interface DiscordActionRow {
  type: 1; // Action Row
  components: DiscordButtonComponent[];
}

interface DiscordWebhookPayload {
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  content?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map priority to a Discord embed color (decimal representation). */
function priorityColor(priority: string): number {
  const map: Record<string, number> = {
    critical: 0xed4245, // Red
    high: 0xf0883e,     // Orange
    medium: 0xfee75c,   // Yellow
    low: 0x57f287,      // Green
  };
  return map[priority] ?? 0x5865f2; // Blurple default
}

/** Map priority to a human-readable display string. */
function priorityDisplay(priority: string): string {
  const map: Record<string, string> = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return map[priority] ?? priority;
}

/** Map a decision string to a Discord-friendly display string. */
function decisionDisplay(decision: string): string {
  const map: Record<string, string> = {
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return map[decision] ?? decision;
}

/** Map a decision string to a Discord embed color. */
function decisionColor(decision: string): number {
  const map: Record<string, number> = {
    approved: 0x57f287,  // Green
    rejected: 0xed4245,  // Red
    cancelled: 0x95a5a6, // Grey
  };
  return map[decision] ?? 0x5865f2;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a Discord notification embed with Approve/Reject buttons.
 *
 * Uses Discord webhook URLs to post rich embeds with interactive buttons.
 * Button `custom_id` values encode the request ID and action so the
 * interaction handler (`/api/discord/interact`) knows what to do.
 *
 * Errors are caught and logged -- Discord notifications must never break the
 * main request flow.
 */
export async function sendDiscordNotification(
  params: DiscordNotificationParams,
): Promise<void> {
  const dashboardUrl = `${APP_URL}/dashboard#request-${params.requestId}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    {
      name: "Priority",
      value: priorityDisplay(params.priority),
      inline: true,
    },
    {
      name: "Request ID",
      value: `\`${params.requestId.slice(0, 8)}...\``,
      inline: true,
    },
  ];

  if (params.connectionName) {
    fields.push({
      name: "Connection",
      value: params.connectionName,
      inline: true,
    });
  }

  const embed: DiscordEmbed = {
    title: `New Approval Request: ${params.title}`,
    description: params.description ?? undefined,
    color: priorityColor(params.priority),
    fields,
    footer: { text: "OKrunit" },
    timestamp: new Date().toISOString(),
  };

  const components: DiscordActionRow[] = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3, // Success (green)
          label: "Approve",
          custom_id: `okrunit:approve:${params.requestId}`,
        },
        {
          type: 2,
          style: 4, // Danger (red)
          label: "Reject",
          custom_id: `okrunit:reject:${params.requestId}`,
        },
        {
          type: 2,
          style: 5, // Link
          label: "View in Dashboard",
          url: dashboardUrl,
        },
      ],
    },
  ];

  const payload: DiscordWebhookPayload = {
    embeds: [embed],
    components,
  };

  try {
    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (params.botToken && params.channelId) {
      // Bot token approach - send via Discord API
      url = `https://discord.com/api/v10/channels/${params.channelId}/messages`;
      headers["Authorization"] = `Bot ${params.botToken}`;
    } else if (params.webhookUrl) {
      // Webhook URL approach
      url = params.webhookUrl;
    } else {
      console.warn("[Discord] No webhook URL or bot token. Skipping.");
      return;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[Discord] API returned ${response.status} for request ${params.requestId}:`,
        body,
      );
      return;
    }

    console.log(
      `[Discord] Notification sent for request ${params.requestId}`,
    );
  } catch (err) {
    console.error("[Discord] Failed to send notification:", err);
  }
}

/**
 * Send a decision notification to Discord (simple embed, no interactive
 * buttons).
 *
 * Errors are caught and logged -- Discord notifications must never break the
 * main request flow.
 */
export async function sendDiscordDecisionNotification(
  params: DiscordDecisionParams,
): Promise<void> {
  const decidedByText = params.decidedBy
    ? `by ${params.decidedBy}`
    : "";

  const description = [
    `**${params.requestTitle}** was **${decisionDisplay(params.decision)}**`,
    decidedByText,
    params.comment ? `\n> ${params.comment}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const embed: DiscordEmbed = {
    title: `Request ${decisionDisplay(params.decision)}`,
    description,
    color: decisionColor(params.decision),
    fields: [],
    footer: { text: "OKrunit" },
    timestamp: new Date().toISOString(),
  };

  const payload: DiscordWebhookPayload = {
    embeds: [embed],
  };

  try {
    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (params.botToken && params.channelId) {
      url = `https://discord.com/api/v10/channels/${params.channelId}/messages`;
      headers["Authorization"] = `Bot ${params.botToken}`;
    } else if (params.webhookUrl) {
      url = params.webhookUrl;
    } else {
      console.warn("[Discord] No webhook URL or bot token. Skipping decision.");
      return;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[Discord] Decision webhook returned ${response.status}:`,
        body,
      );
      return;
    }

    console.log(
      `[Discord] Decision notification sent for "${params.requestTitle}"`,
    );
  } catch (err) {
    console.error("[Discord] Failed to send decision notification:", err);
  }
}
