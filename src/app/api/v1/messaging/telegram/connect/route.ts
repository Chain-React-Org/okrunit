// ---------------------------------------------------------------------------
// OKrunit -- Telegram Bot Connect Route
// ---------------------------------------------------------------------------
// POST /api/v1/messaging/telegram/connect
//
// Accepts a bot token and chat ID, validates them by calling the Telegram API,
// registers the webhook, and stores the messaging connection.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const connectSchema = z.object({
  bot_token: z
    .string()
    .min(1, "Bot token is required")
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "Invalid bot token format"),
  chat_id: z
    .string()
    .min(1, "Chat ID is required"),
});

interface TelegramGetMeResponse {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
  description?: string;
}

interface TelegramGetChatResponse {
  ok: boolean;
  result?: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
  };
  description?: string;
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    let userId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
      userId = auth.user.id;
      // Check admin/owner role
      if (!["owner", "admin"].includes(auth.membership.role)) {
        throw new ApiError(403, "Admin or owner role required");
      }
    } else {
      throw new ApiError(401, "Session authentication required");
    }

    // Validate input
    const body = await request.json();
    const parsed = connectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { bot_token, chat_id } = parsed.data;

    // 1. Validate the bot token by calling getMe
    const getMeResponse = await fetch(
      `${TELEGRAM_API_BASE}/bot${bot_token}/getMe`,
    );
    const getMeData: TelegramGetMeResponse = await getMeResponse.json();

    if (!getMeData.ok || !getMeData.result?.is_bot) {
      return NextResponse.json(
        {
          error: "Invalid bot token",
          details: getMeData.description ?? "The token does not belong to a valid bot",
        },
        { status: 400 },
      );
    }

    const botUsername = getMeData.result.username;
    const botName = getMeData.result.first_name;

    // 2. Validate the chat ID by calling getChat
    const getChatResponse = await fetch(
      `${TELEGRAM_API_BASE}/bot${bot_token}/getChat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id }),
      },
    );
    const getChatData: TelegramGetChatResponse = await getChatResponse.json();

    if (!getChatData.ok) {
      return NextResponse.json(
        {
          error: "Invalid chat ID",
          details:
            getChatData.description ??
            "The bot cannot access this chat. Make sure the bot is added to the group/channel.",
        },
        { status: 400 },
      );
    }

    const chatTitle =
      getChatData.result?.title ??
      getChatData.result?.first_name ??
      getChatData.result?.username ??
      chat_id;

    // 3. Register the webhook URL with Telegram
    const webhookUrl = `${APP_URL}/api/telegram/webhook`;

    const setWebhookResponse = await fetch(
      `${TELEGRAM_API_BASE}/bot${bot_token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["callback_query", "message"],
        }),
      },
    );

    const setWebhookData: { ok: boolean; description?: string } =
      await setWebhookResponse.json();

    if (!setWebhookData.ok) {
      logger.error(
        "[Telegram Connect] setWebhook failed:",
        setWebhookData.description,
      );
      // Non-fatal: we can still send messages, just won't receive callbacks
    }

    // 4. Store the connection
    const admin = createAdminClient();

    const { data: connection, error: upsertError } = await admin
      .from("messaging_connections")
      .upsert(
        {
          org_id: orgId,
          platform: "telegram",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          bot_token: bot_token,
          workspace_id: botUsername,
          workspace_name: botName,
          channel_id: chat_id,
          channel_name: chatTitle,
          webhook_url: null, // Telegram doesn't use webhook URLs for sending
          is_active: true,
          installed_by: userId,
        },
        { onConflict: "org_id,platform,channel_id" },
      )
      .select("id")
      .single();

    if (upsertError) {
      logger.error("[Telegram Connect] Upsert failed:", upsertError);
      return NextResponse.json(
        { error: "Failed to save connection" },
        { status: 500 },
      );
    }

    // 5. Audit log
    logAuditEvent({
      orgId,
      userId,
      action: "messaging_connection.created",
      resourceType: "messaging_connection",
      resourceId: connection?.id ?? undefined,
      ipAddress: getClientIp(request),
      details: {
        platform: "telegram",
        bot_username: botUsername,
        chat_id,
        chat_title: chatTitle,
      },
    });

    return NextResponse.json({
      success: true,
      connection: {
        platform: "telegram",
        bot_name: botName,
        bot_username: botUsername,
        chat_id,
        chat_title: chatTitle,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
