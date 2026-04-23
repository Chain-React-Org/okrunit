// ---------------------------------------------------------------------------
// OKrunit -- Telegram Webhook Route
// ---------------------------------------------------------------------------
//
// Flow:
//   1. User clicks Approve/Reject button → prompted for a reason
//   2. User types their reason → decision applied with comment
//   3. User sends /skip → decision applied without comment
//      (unless rejection reason is REQUIRED by org policy, then /skip is blocked)
//
// Callback data formats:
//   okrunit:approve:<requestId>   -- Approve (prompts for reason)
//   okrunit:reject:<requestId>    -- Reject (prompts for reason)
//   okrunit:reason:reject:<requestId> -- Forced reason prompt (legacy)
// ---------------------------------------------------------------------------

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";
import { getDecisionCommentPolicy } from "@/lib/api/rejection-reason";
import {
  answerCallbackQuery,
  editMessage,
} from "@/lib/notifications/channels/telegram";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  from?: TelegramUser;
  text?: string;
  reply_to_message?: TelegramMessage;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
}

// ---------------------------------------------------------------------------
// Pending reason prompts (only used when rejection reason is required)
// ---------------------------------------------------------------------------

interface PendingReason {
  action: "approve" | "reject";
  requestId: string;
  botMessageId: number;
  reasonRequired: boolean;
  expiresAt: number;
}

const pendingReasons = new Map<string, PendingReason>();
const PENDING_TTL_MS = 10 * 60 * 1000;

function pendingKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, value] of pendingReasons) {
    if (value.expiresAt < now) pendingReasons.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function verifyTelegramSecret(expected: string, header: string): boolean {
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(header, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function telegramDisplayName(user: TelegramUser): string {
  if (user.username) return `@${user.username}`;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ") || `User ${user.id}`;
}

// ---------------------------------------------------------------------------
// Apply decision to the approval
// ---------------------------------------------------------------------------

async function applyDecision(request: Request, params: {
  decision: "approve" | "reject";
  requestId: string;
  telegramUser: TelegramUser;
  chatId?: number;
  messageId?: number;
  comment?: string;
}): Promise<void> {
  const { decision, requestId, telegramUser, chatId, messageId, comment } =
    params;
  const displayName = telegramDisplayName(telegramUser);
  const admin = createAdminClient();

  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !approval) {
    if (chatId && messageId) {
      await editMessage(
        String(chatId),
        messageId,
        escapeMarkdownV2(
          "\u26A0\uFE0F Approval request not found. It may have been deleted.",
        ),
      );
    }
    return;
  }

  if (approval.status !== "pending") {
    if (chatId && messageId) {
      await editMessage(
        String(chatId),
        messageId,
        escapeMarkdownV2(
          `\u2139\uFE0F Already ${approval.status}. No action taken.`,
        ),
      );
    }
    return;
  }

  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);
    if (chatId && messageId) {
      await editMessage(
        String(chatId),
        messageId,
        escapeMarkdownV2("\u231B This request has expired."),
      );
    }
    return;
  }

  const newStatus = decision === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();

  const { data: orgMember } = await admin
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", approval.org_id)
    .limit(1)
    .maybeSingle();

  const decidedBy = orgMember?.user_id ?? null;

  // Build attribution tag for audit trail
  const telegramAttribution = `[Decided via Telegram by ${displayName}]`;

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    decided_by: decidedBy,
    decided_at: decidedAt,
    decision_source: "telegram",
  };
  if (comment) {
    updatePayload.decision_comment = `${comment}\n\n${telegramAttribution}`;
  } else {
    updatePayload.decision_comment = telegramAttribution;
  }

  const { data: updated, error: updateError } = await admin
    .from("approval_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (updateError || !updated) {
    logger.error("[Telegram Webhook] Update failed:", updateError);
    return;
  }

  logAuditEvent({
    orgId: approval.org_id,
    userId: decidedBy ?? undefined,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: requestId,
    details: {
      decision,
      decision_source: "telegram",
      decision_comment: comment ?? null,
      telegram_user_id: telegramUser.id,
      telegram_display_name: displayName,
    },
    ipAddress: getClientIp(request),
  });

  if (approval.callback_url) {
    deliverCallback({
      requestId: approval.id,
      connectionId: approval.connection_id,
      callbackUrl: approval.callback_url,
      callbackHeaders:
        (approval.callback_headers as Record<string, string>) ?? undefined,
      payload: {
        id: updated.id,
        status: updated.status,
        decided_by: updated.decided_by,
        decided_at: updated.decided_at,
        decision_comment: updated.decision_comment,
        title: updated.title,
        priority: updated.priority,
        metadata: updated.metadata,
      },
    });
  }

  if (chatId && messageId) {
    const emoji = newStatus === "approved" ? "\u2705" : "\u274C";
    const label = newStatus === "approved" ? "Approved" : "Rejected";
    const commentLine = comment ? `\nReason: ${comment}` : "";

    await editMessage(
      String(chatId),
      messageId,
      `${emoji} ${label}: ${approval.title}\nby ${displayName}${commentLine}`,
      undefined,
      false,
    );
  }
}

// ---------------------------------------------------------------------------
// Handle /start <nonce> deep-link command
// ---------------------------------------------------------------------------

const TELEGRAM_API_BASE = "https://api.telegram.org";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function sendBotMessage(
  botToken: string,
  chatId: number,
  text: string,
): Promise<void> {
  await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((err) => {
    logger.error("[Telegram Webhook] sendMessage failed:", err);
  });
}

async function handleStartCommand(
  botToken: string,
  nonce: string,
  msg: TelegramMessage,
): Promise<void> {
  const admin = createAdminClient();
  const chatId = msg.chat.id;
  const chatTitle =
    (msg.chat as { title?: string }).title ??
    msg.from?.first_name ??
    msg.from?.username ??
    String(chatId);

  // Look up the nonce
  const { data: link, error: lookupError } = await admin
    .from("telegram_link_nonces")
    .select("id, org_id, created_by, claimed_at, expires_at")
    .eq("nonce", nonce)
    .single();

  if (lookupError || !link) {
    await sendBotMessage(
      botToken,
      chatId,
      "This link is invalid or has already been used. Please generate a new one from OKrunit.",
    );
    return;
  }

  if (link.claimed_at) {
    await sendBotMessage(
      botToken,
      chatId,
      "This link has already been used. Your chat is connected!",
    );
    return;
  }

  if (new Date(link.expires_at) < new Date()) {
    await sendBotMessage(
      botToken,
      chatId,
      "This link has expired. Please generate a new one from OKrunit.",
    );
    return;
  }

  // Get bot info for workspace fields
  const getMeRes = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/getMe`,
  );
  const getMeData = await getMeRes.json();
  const botUsername = getMeData.result?.username ?? "OKrunitBot";
  const botName = getMeData.result?.first_name ?? "OKrunit";

  // Create the messaging connection
  const { data: connection, error: upsertError } = await admin
    .from("messaging_connections")
    .upsert(
      {
        org_id: link.org_id,
        platform: "telegram",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        bot_token: null, // uses env var TELEGRAM_BOT_TOKEN
        workspace_id: botUsername,
        workspace_name: botName,
        channel_id: String(chatId),
        channel_name: chatTitle,
        webhook_url: null,
        is_active: true,
        installed_by: link.created_by,
      },
      { onConflict: "org_id,platform,channel_id" },
    )
    .select("id")
    .single();

  if (upsertError) {
    logger.error("[Telegram Webhook] Connection upsert failed:", upsertError);
    await sendBotMessage(
      botToken,
      chatId,
      "Something went wrong connecting this chat. Please try again.",
    );
    return;
  }

  // Mark the nonce as claimed
  await admin
    .from("telegram_link_nonces")
    .update({
      claimed_at: new Date().toISOString(),
      chat_id: String(chatId),
      chat_title: chatTitle,
      connection_id: connection?.id ?? null,
    })
    .eq("id", link.id);

  // Seed messaging_user_identities so this Telegram user can act on approvals
  // via the Mini App without re-linking. The nonce was created by a
  // logged-in OKrunit user, so the mapping is legitimate.
  if (msg.from?.id) {
    await admin
      .from("messaging_user_identities")
      .upsert(
        {
          org_id: link.org_id,
          user_id: link.created_by,
          platform: "telegram",
          external_user_id: String(msg.from.id),
          external_username: msg.from.username ?? null,
        },
        { onConflict: "org_id,platform,external_user_id" },
      );
  }

  // Audit log
  logAuditEvent({
    orgId: link.org_id,
    userId: link.created_by,
    action: "messaging_connection.created",
    resourceType: "messaging_connection",
    resourceId: connection?.id ?? undefined,
    details: {
      platform: "telegram",
      bot_username: botUsername,
      chat_id: String(chatId),
      chat_title: chatTitle,
      method: "deep_link",
    },
  });

  // Ensure webhook is set up for this bot (callback_query + message)
  const webhookUrl = `${APP_URL}/api/telegram/webhook`;
  await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["callback_query", "message"],
    }),
  }).catch(() => {});

  await sendBotMessage(
    botToken,
    chatId,
    `Connected to OKrunit! You'll receive approval notifications in this chat.\n\nYou can manage notification settings at ${APP_URL}/requests/messaging`,
  );
}

// ---------------------------------------------------------------------------
// POST /api/telegram/webhook
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error("[Telegram Webhook] TELEGRAM_BOT_TOKEN is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  // If a webhook secret is configured, always require it
  if (webhookSecret) {
    if (!secretHeader || !verifyTelegramSecret(webhookSecret, secretHeader)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  cleanExpired();

  // -------------------------------------------------------------------------
  // Handle text messages
  // -------------------------------------------------------------------------
  if (update.message && !update.callback_query) {
    const msg = update.message;
    const fromUser = msg.from;
    if (!fromUser || !msg.text) return NextResponse.json({ ok: true });

    // -----------------------------------------------------------------------
    // /start <nonce> - deep-link connection flow
    // -----------------------------------------------------------------------
    const startMatch = msg.text.match(/^\/start\s+(.+)$/);
    if (startMatch) {
      const nonce = startMatch[1];
      await handleStartCommand(botToken, nonce, msg);
      return NextResponse.json({ ok: true });
    }

    // -----------------------------------------------------------------------
    // Reply with reason for pending approve/reject
    // -----------------------------------------------------------------------
    const key = pendingKey(msg.chat.id, fromUser.id);
    const pending = pendingReasons.get(key);
    if (!pending) return NextResponse.json({ ok: true });

    const isSkip = msg.text.trim().toLowerCase() === "/skip";

    if (isSkip && pending.reasonRequired) {
      // Reason is required, don't allow skip
      await sendBotMessage(
        botToken,
        msg.chat.id,
        "⚠️ A reason is required and cannot be skipped. Please type your reason:",
      );
      return NextResponse.json({ ok: true });
    }

    pendingReasons.delete(key);

    await applyDecision(request, {
      decision: pending.action,
      requestId: pending.requestId,
      telegramUser: fromUser,
      chatId: msg.chat.id,
      messageId: pending.botMessageId,
      comment: isSkip ? undefined : msg.text,
    });

    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Handle button clicks
  // -------------------------------------------------------------------------
  const cb = update.callback_query;
  if (!cb?.data) return NextResponse.json({ ok: true });

  const parts = cb.data.split(":");
  if (parts[0] !== "okrunit" || parts.length < 3) {
    await answerCallbackQuery(cb.id, "Unknown action");
    return NextResponse.json({ ok: true });
  }

  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;

  // -------------------------------------------------------------------------
  // Approve - prompt for reason (unless org skips it)
  // -------------------------------------------------------------------------
  if (parts[1] === "approve" && parts.length === 3) {
    const requestId = parts[2];

    const admin = createAdminClient();
    const { data: approval } = await admin
      .from("approval_requests")
      .select("org_id, require_rejection_reason, priority")
      .eq("id", requestId)
      .single();

    const { showPrompt } = approval
      ? await getDecisionCommentPolicy(approval.org_id, "approve", {
          require_rejection_reason: approval.require_rejection_reason,
          priority: approval.priority,
        })
      : { showPrompt: true };

    if (!showPrompt) {
      // Skip prompt. Apply immediately.
      await answerCallbackQuery(cb.id, "Approved!");
      await applyDecision(request, {
        decision: "approve",
        requestId,
        telegramUser: cb.from,
        chatId,
        messageId,
      });
      return NextResponse.json({ ok: true });
    }

    await answerCallbackQuery(cb.id, "");
    if (chatId && messageId) {
      pendingReasons.set(pendingKey(chatId, cb.from.id), {
        action: "approve",
        requestId,
        botMessageId: messageId,
        reasonRequired: false,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
      await editMessage(
        String(chatId),
        messageId,
        "✅ Approving: type your reason below, or send /skip to approve without a reason.",
        undefined,
        false,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Reject - prompt for reason (unless org skips it and reason not required)
  // -------------------------------------------------------------------------
  if (parts[1] === "reject" && parts.length === 3) {
    const requestId = parts[2];

    const admin = createAdminClient();
    const { data: approval } = await admin
      .from("approval_requests")
      .select("org_id, require_rejection_reason, priority")
      .eq("id", requestId)
      .single();

    const { showPrompt, reasonRequired } = approval
      ? await getDecisionCommentPolicy(approval.org_id, "reject", {
          require_rejection_reason: approval.require_rejection_reason,
          priority: approval.priority,
        })
      : { showPrompt: true, reasonRequired: false };

    if (!showPrompt) {
      // Skip prompt. Apply immediately.
      await answerCallbackQuery(cb.id, "Rejected!");
      await applyDecision(request, {
        decision: "reject",
        requestId,
        telegramUser: cb.from,
        chatId,
        messageId,
      });
      return NextResponse.json({ ok: true });
    }

    await answerCallbackQuery(cb.id, "");
    if (chatId && messageId) {
      pendingReasons.set(pendingKey(chatId, cb.from.id), {
        action: "reject",
        requestId,
        botMessageId: messageId,
        reasonRequired,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });

      const prompt = reasonRequired
        ? "❌ Rejecting: a reason is required.\n\nType your reason below."
        : "❌ Rejecting: type your reason below, or send /skip to reject without a reason.";

      await editMessage(
        String(chatId),
        messageId,
        prompt,
        undefined,
        false,
      );
    }
    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Forced reason prompt submit (legacy format, kept for compatibility)
  // -------------------------------------------------------------------------
  if (parts[1] === "reason" && parts.length === 4) {
    const action = parts[2] as "reject";
    const requestId = parts[3];

    await answerCallbackQuery(cb.id, "");
    if (chatId && messageId) {
      pendingReasons.set(pendingKey(chatId, cb.from.id), {
        action,
        requestId,
        botMessageId: messageId,
        reasonRequired: true,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
      await editMessage(
        String(chatId),
        messageId,
        "⚠️ Please type your rejection reason below:",
        undefined,
        false,
      );
    }
    return NextResponse.json({ ok: true });
  }

  await answerCallbackQuery(cb.id, "Unknown action");
  return NextResponse.json({ ok: true });
}
