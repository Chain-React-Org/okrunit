// ---------------------------------------------------------------------------
// OKrunit -- Telegram Notification Channel (Bot API)
// ---------------------------------------------------------------------------

import { logger } from "@/lib/monitoring/logger";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = "https://api.telegram.org";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelegramNotificationParams {
  chatId: string;
  botToken?: string; // Per-connection bot token (overrides env var)
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  connectionName?: string;
  /** Whether to render Approve/Reject callback buttons. Set to false for
   * viewers and later-in-chain approvers so they don't click through to a
   * "not your turn" error. A View-in-Dashboard link is always rendered. */
  showActionButtons?: boolean;
}

export interface TelegramDecisionParams {
  chatId: string;
  botToken?: string; // Per-connection bot token (overrides env var)
  requestTitle: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map priority to an emoji and display string. */
function priorityEmoji(priority: string): string {
  const map: Record<string, string> = {
    critical: "\uD83D\uDEA8 Critical",
    high: "\uD83D\uDD34 High",
    medium: "\uD83D\uDFE0 Medium",
    low: "\uD83D\uDFE2 Low",
  };
  return map[priority] ?? `\u26AA ${priority}`;
}

/** Map a decision string to a display string. */
function decisionDisplay(decision: string): string {
  const map: Record<string, string> = {
    approved: "\u2705 Approved",
    rejected: "\u274C Rejected",
    cancelled: "\uD83D\uDEAB Cancelled",
  };
  return map[decision] ?? decision;
}

/** Escape special characters for Telegram MarkdownV2. */
function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/** Get the bot token, returning null if not configured. */
function getBotToken(): string | null {
  return TELEGRAM_BOT_TOKEN ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a Telegram notification with inline keyboard buttons for
 * approve/reject.
 *
 * The callback_data encodes the request ID and action so the webhook
 * handler at `/api/telegram/webhook` knows what to do.
 *
 * Errors are caught and logged -- Telegram notifications must never break
 * the main request flow.
 */
export async function sendTelegramNotification(
  params: TelegramNotificationParams,
): Promise<void> {
  const botToken = params.botToken ?? getBotToken();

  if (!botToken) {
    logger.warn(
      "[Telegram] No bot token available -- skipping notification for request",
      params.requestId,
    );
    return;
  }

  const dashboardUrl = `${APP_URL}/dashboard#request-${params.requestId}`;

  const descriptionLine = params.description
    ? `\n${params.description}`
    : "";

  const connectionLine = params.connectionName
    ? `\nConnection: ${params.connectionName}`
    : "";

  const text = [
    "🔔 Approval Required",
    "",
    params.title,
    descriptionLine,
    "",
    `Priority: ${priorityEmoji(params.priority)}`,
    `Request ID: ${params.requestId.slice(0, 8)}`,
    connectionLine,
  ]
    .filter((line) => line !== "")
    .join("\n");

  // Callback-based buttons so Telegram sends the click to our webhook. The
  // webhook already handles the approve/reject callback and prompts for a
  // reason via an edited message + pendingReasons state machine — no mini app
  // needed. A third link button still jumps to the web dashboard for anyone
  // who wants the full detail view.
  const approveCallback = `okrunit:approve:${params.requestId}`;
  const rejectCallback = `okrunit:reject:${params.requestId}`;

  // Only render Approve/Reject to the current-turn approver (for sequential)
  // or to an assigned approver (for parallel). Viewers and later-in-chain
  // approvers see a static message with a "View in Dashboard" button only —
  // the same info is present but the action buttons don't lead them to
  // click through to an error.
  const actionRow = params.showActionButtons
    ? [
        {
          text: "\u2705 Approve",
          callback_data: approveCallback,
        },
        {
          text: "\u274C Reject",
          callback_data: rejectCallback,
        },
      ]
    : null;

  const inlineKeyboard = {
    inline_keyboard: [
      ...(actionRow ? [actionRow] : []),
      [
        {
          text: "\uD83D\uDD0D View in Dashboard",
          url: dashboardUrl,
        },
      ],
    ],
  };

  try {
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text,
        reply_markup: inlineKeyboard,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[Telegram] API returned ${response.status} for request ${params.requestId}:`,
        body,
      );
      return;
    }

    logger.info(
      `[Telegram] Notification sent for request ${params.requestId}`,
    );
  } catch (err) {
    logger.error("[Telegram] Failed to send notification:", err);
  }
}

/**
 * Send a decision notification to Telegram (simple message, no interactive
 * buttons).
 *
 * Errors are caught and logged -- Telegram notifications must never break
 * the main request flow.
 */
export async function sendTelegramDecisionNotification(
  params: TelegramDecisionParams,
): Promise<void> {
  const botToken = params.botToken ?? getBotToken();

  if (!botToken) {
    logger.warn(
      "[Telegram] No bot token available -- skipping decision notification for",
      params.requestTitle,
    );
    return;
  }

  const decidedByText = params.decidedBy
    ? ` by ${escapeMarkdownV2(params.decidedBy)}`
    : "";

  const commentText = params.comment
    ? `\n\n_${escapeMarkdownV2(params.comment)}_`
    : "";

  const text = `${escapeMarkdownV2(decisionDisplay(params.decision))} *${escapeMarkdownV2(params.requestTitle)}*${decidedByText}${commentText}`;

  try {
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text,
        parse_mode: "MarkdownV2",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[Telegram] Decision API returned ${response.status}:`,
        body,
      );
      return;
    }

    logger.info(
      `[Telegram] Decision notification sent for "${params.requestTitle}"`,
    );
  } catch (err) {
    logger.error("[Telegram] Failed to send decision notification:", err);
  }
}

/**
 * Answer a Telegram callback query. This removes the "loading" indicator
 * on the inline keyboard button the user pressed.
 *
 * Errors are caught and logged -- must never break the main flow.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
): Promise<void> {
  const botToken = getBotToken();
  if (!botToken) return;

  try {
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch (err) {
    logger.error("[Telegram] Failed to answer callback query:", err);
  }
}

/**
 * Edit an existing Telegram message to replace it with updated text
 * (e.g. after a decision has been made).
 *
 * Optionally include an inline keyboard via reply_markup.
 *
 * Errors are caught and logged -- must never break the main flow.
 */
export async function editMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: object,
  useMarkdown: boolean = true,
): Promise<void> {
  const botToken = getBotToken();
  if (!botToken) return;

  try {
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/editMessageText`;

    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };

    if (useMarkdown) {
      body.parse_mode = "MarkdownV2";
    }

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      logger.error(
        `[Telegram] editMessageText returned ${response.status}:`,
        responseBody,
      );
    }
  } catch (err) {
    logger.error("[Telegram] Failed to edit message:", err);
  }
}
