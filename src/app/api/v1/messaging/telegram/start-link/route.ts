// ---------------------------------------------------------------------------
// OKrunit -- Telegram Deep-Link Start Route
// ---------------------------------------------------------------------------
// POST /api/v1/messaging/telegram/start-link
//
// Generates a one-time nonce and returns a t.me deep link. The user opens
// it in Telegram, presses Start, and the webhook completes the connection.
// ---------------------------------------------------------------------------

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = "https://api.telegram.org";
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    let userId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
      userId = auth.user.id;
      if (!["owner", "admin"].includes(auth.membership.role)) {
        throw new ApiError(403, "Admin or owner role required");
      }
    } else {
      throw new ApiError(401, "Session authentication required");
    }

    if (!TELEGRAM_BOT_TOKEN) {
      throw new ApiError(500, "Telegram bot is not configured");
    }

    // Get bot username to build the deep link
    const getMeRes = await fetch(
      `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/getMe`,
    );
    const getMeData = await getMeRes.json();

    if (!getMeData.ok || !getMeData.result?.username) {
      throw new ApiError(500, "Failed to get bot info from Telegram");
    }

    const botUsername = getMeData.result.username;

    // Generate a URL-safe nonce
    const nonce = randomBytes(16).toString("base64url");
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

    const admin = createAdminClient();
    const { error } = await admin.from("telegram_link_nonces").insert({
      nonce,
      org_id: orgId,
      created_by: userId,
      expires_at: expiresAt,
    });

    if (error) {
      logger.error("[Telegram Start-Link] Insert failed:", error);
      throw new ApiError(500, "Failed to create link");
    }

    // Ensure the webhook is set up to receive messages (not just callback_query)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${APP_URL}/api/telegram/webhook`;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    const webhookBody: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["callback_query", "message"],
    };
    // Telegram only allows A-Za-z0-9_- in secret_token (1-256 chars)
    if (webhookSecret && /^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
      webhookBody.secret_token = webhookSecret;
    }

    await fetch(`${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookBody),
    }).catch((err) => {
      logger.error("[Telegram Start-Link] setWebhook failed:", err);
    });

    const deepLink = `https://t.me/${botUsername}?start=${nonce}`;

    return NextResponse.json({
      nonce,
      deep_link: deepLink,
      bot_username: botUsername,
      expires_at: expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
