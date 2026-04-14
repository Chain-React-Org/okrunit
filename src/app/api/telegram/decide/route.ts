// ---------------------------------------------------------------------------
// OKrunit -- Telegram Mini App Decision API
// ---------------------------------------------------------------------------
//
// GET  /api/telegram/decide?id=<requestId>  - Fetch request info for the form
// POST /api/telegram/decide                 - Submit a decision
//
// Authentication: Telegram initData is passed via X-Telegram-Init-Data header.
// We validate it using HMAC-SHA256 with the bot token as specified by the
// Telegram Bot API docs.
// ---------------------------------------------------------------------------

import { createHmac } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";
import { getDecisionCommentPolicy } from "@/lib/api/rejection-reason";

// ---------------------------------------------------------------------------
// Telegram initData validation
// ---------------------------------------------------------------------------

interface TelegramInitUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

function validateTelegramInitData(
  initData: string,
  botToken: string,
): TelegramInitUser | null {
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    // Remove hash from the data
    params.delete("hash");

    // Sort remaining params alphabetically and join with \n
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // HMAC-SHA256 with secret key derived from bot token
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const computedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) return null;

    // Check auth_date is not too old (allow 24 hours)
    const authDate = parseInt(params.get("auth_date") ?? "0", 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return null;

    // Parse user
    const userStr = params.get("user");
    if (!userStr) return null;

    return JSON.parse(userStr) as TelegramInitUser;
  } catch {
    return null;
  }
}

function telegramDisplayName(user: TelegramInitUser): string {
  if (user.username) return `@${user.username}`;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ") || `User ${user.id}`;
}

// ---------------------------------------------------------------------------
// GET - Fetch request info for the Mini App form
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const requestId = url.searchParams.get("id");
  if (!requestId) {
    return NextResponse.json({ error: "Missing request ID" }, { status: 400 });
  }

  // Validate Telegram initData
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("id, title, description, priority, status, org_id, require_rejection_reason")
    .eq("id", requestId)
    .single();

  if (fetchError || !approval) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `This request has already been ${approval.status}` },
      { status: 409 },
    );
  }

  // Check rejection reason policy
  const { reasonRequired } = await getDecisionCommentPolicy(
    approval.org_id,
    "reject",
    {
      require_rejection_reason: approval.require_rejection_reason,
      priority: approval.priority,
    },
  );

  return NextResponse.json({
    id: approval.id,
    title: approval.title,
    description: approval.description,
    priority: approval.priority,
    status: approval.status,
    reasonRequired,
  });
}

// ---------------------------------------------------------------------------
// POST - Submit a decision from the Mini App
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Validate Telegram initData
  const initData = request.headers.get("X-Telegram-Init-Data") ?? "";
  const user = validateTelegramInitData(initData, botToken);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { requestId: string; action: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { requestId, action, comment } = body;
  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !approval) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `Already ${approval.status}` },
      { status: 409 },
    );
  }

  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);
    return NextResponse.json({ error: "This request has expired" }, { status: 409 });
  }

  // Check if rejection reason is required
  if (action === "reject") {
    const { reasonRequired } = await getDecisionCommentPolicy(
      approval.org_id,
      "reject",
      {
        require_rejection_reason: approval.require_rejection_reason,
        priority: approval.priority,
      },
    );
    if (reasonRequired && !comment?.trim()) {
      return NextResponse.json(
        { error: "A rejection reason is required" },
        { status: 422 },
      );
    }
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();
  const displayName = telegramDisplayName(user);

  const { data: orgMember } = await admin
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", approval.org_id)
    .limit(1)
    .maybeSingle();

  const decidedBy = orgMember?.user_id ?? null;

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    decided_by: decidedBy,
    decided_at: decidedAt,
    decision_source: "telegram",
  };
  if (comment?.trim()) updatePayload.decision_comment = comment.trim();

  const { data: updated, error: updateError } = await admin
    .from("approval_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  // Audit log
  logAuditEvent({
    orgId: approval.org_id,
    userId: decidedBy ?? undefined,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: requestId,
    details: {
      decision: action,
      decision_source: "telegram",
      decision_comment: comment ?? null,
      telegram_user_id: user.id,
      telegram_display_name: displayName,
    },
    ipAddress: getClientIp(request),
  });

  // Deliver callback
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

  // Try to update the original Telegram message if we can find it
  // (best-effort, we may not have the message/chat IDs here)
  const { data: connection } = await admin
    .from("messaging_connections")
    .select("channel_id")
    .eq("org_id", approval.org_id)
    .eq("platform", "telegram")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (connection?.channel_id) {
    const emoji = newStatus === "approved" ? "\u2705" : "\u274C";
    const label = newStatus === "approved" ? "Approved" : "Rejected";
    const commentLine = comment?.trim() ? `\nReason: ${comment.trim()}` : "";

    // We don't have the messageId, so we can't edit the original message.
    // But we can send a new confirmation message.
    const confirmText = `${emoji} ${label}: ${approval.title}\nby ${displayName}${commentLine}`;

    const telegramApiBase = "https://api.telegram.org";
    await fetch(`${telegramApiBase}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: connection.channel_id,
        text: confirmText,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
