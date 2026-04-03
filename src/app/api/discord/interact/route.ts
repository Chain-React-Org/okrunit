// ---------------------------------------------------------------------------
// OKrunit -- Discord Interaction Callback Route
// ---------------------------------------------------------------------------
//
// Receives interaction payloads from Discord when a user clicks an
// "Approve" or "Reject" button, or submits a modal with a reason.
//
// Flow:
//   1. User clicks Approve/Reject button (MESSAGE_COMPONENT)
//   2. Bot responds with a Modal containing a text input for the reason
//   3. User submits modal (MODAL_SUBMIT) -> decision is applied with reason
//
// If the rejection reason is not required, the modal text input is optional.
//
// Required env vars:
//   DISCORD_PUBLIC_KEY  -- The application's public key for signature verification
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";
import { getDecisionCommentPolicy } from "@/lib/api/rejection-reason";

// ---------------------------------------------------------------------------
// Discord Interaction Types
// ---------------------------------------------------------------------------

const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

const CALLBACK_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;

/** Discord component types. */
const COMPONENT_TYPE = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
} as const;

/** Discord text input styles. */
const TEXT_INPUT_STYLE = {
  SHORT: 1,
  PARAGRAPH: 2,
} as const;

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string;
  discriminator?: string;
}

interface DiscordInteractionData {
  custom_id: string;
  component_type?: number;
  components?: Array<{
    type: number;
    components?: Array<{
      type: number;
      custom_id: string;
      value?: string;
    }>;
  }>;
}

interface DiscordInteraction {
  type: number;
  data?: DiscordInteractionData;
  user?: DiscordUser;
  member?: { user: DiscordUser };
  message?: {
    embeds?: Array<{
      title?: string;
      description?: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Ed25519 Signature Verification
// ---------------------------------------------------------------------------

async function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  try {
    const keyBytes = hexToUint8Array(publicKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes.buffer as ArrayBuffer,
      { name: "Ed25519" },
      false,
      ["verify"],
    );

    const message = new TextEncoder().encode(timestamp + body);
    const signatureBytes = hexToUint8Array(signature);

    return await crypto.subtle.verify(
      "Ed25519",
      cryptoKey,
      signatureBytes.buffer as ArrayBuffer,
      message,
    );
  } catch (err) {
    console.error("[Discord Interact] Signature verification error:", err);
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decisionEmoji(decision: string): string {
  const map: Record<string, string> = {
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[decision] ?? decision;
}

function decisionColor(decision: string): number {
  const map: Record<string, number> = {
    approved: 0x57f287,
    rejected: 0xed4245,
  };
  return map[decision] ?? 0x5865f2;
}

function buildDecisionResponse(
  title: string,
  decision: string,
  discordUser: string,
  comment?: string,
): object {
  const commentText = comment ? `\n\n**Reason:** ${comment}` : "";

  return {
    type: CALLBACK_TYPE.UPDATE_MESSAGE,
    data: {
      embeds: [
        {
          title: `Request ${decisionEmoji(decision)}`,
          description: `**${title}** was **${decisionEmoji(decision)}** by ${discordUser}${commentText}`,
          color: decisionColor(decision),
          footer: { text: "OKrunit" },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [],
    },
  };
}

function buildInfoResponse(message: string): object {
  return {
    type: CALLBACK_TYPE.UPDATE_MESSAGE,
    data: {
      embeds: [
        {
          description: message,
          color: 0xfee75c,
          footer: { text: "OKrunit" },
        },
      ],
      components: [],
    },
  };
}

/**
 * Build a modal response that prompts the user for a reason.
 */
function buildReasonModal(
  action: string,
  requestId: string,
  title: string,
  reasonRequired: boolean,
): object {
  const actionLabel = action === "approve" ? "Approval" : "Rejection";

  return {
    type: CALLBACK_TYPE.MODAL,
    data: {
      custom_id: `okrunit:modal:${action}:${requestId}`,
      title: `${actionLabel} Reason`,
      components: [
        {
          type: COMPONENT_TYPE.ACTION_ROW,
          components: [
            {
              type: COMPONENT_TYPE.TEXT_INPUT,
              custom_id: "reason",
              label: `Reason for ${actionLabel.toLowerCase()}`,
              style: TEXT_INPUT_STYLE.PARAGRAPH,
              placeholder: "Enter your reason here...",
              required: reasonRequired,
              min_length: reasonRequired ? 1 : 0,
              max_length: 4000,
            },
          ],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Core: Apply the decision
// ---------------------------------------------------------------------------

async function applyDecision(request: Request, params: {
  decision: "approve" | "reject";
  requestId: string;
  discordUserId: string;
  discordUsername: string;
  comment?: string;
}): Promise<
  | { success: true; approval: Record<string, unknown>; updated: Record<string, unknown>; newStatus: string }
  | { success: false; response: object }
> {
  const { decision, requestId, discordUserId, discordUsername, comment } =
    params;
  const admin = createAdminClient();

  // Fetch the approval request.
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !approval) {
    return {
      success: false,
      response: buildInfoResponse(
        "Approval request not found. It may have been deleted.",
      ),
    };
  }

  if (approval.status !== "pending") {
    return {
      success: false,
      response: buildInfoResponse(
        `This request has already been **${approval.status}**. No action taken.`,
      ),
    };
  }

  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);

    return {
      success: false,
      response: buildInfoResponse(
        "This request has expired and can no longer be actioned.",
      ),
    };
  }

  const newStatus = decision === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();

  const { data: userProfile } = await admin
    .from("user_profiles")
    .select("id")
    .eq("org_id", approval.org_id)
    .limit(1)
    .maybeSingle();

  const decidedBy = userProfile?.id ?? null;

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    decided_by: decidedBy,
    decided_at: decidedAt,
    decision_source: "discord",
  };

  if (comment) {
    updatePayload.decision_comment = comment;
  }

  const { data: updated, error: updateError } = await admin
    .from("approval_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (updateError || !updated) {
    console.error(
      "[Discord Interact] Failed to update approval:",
      updateError,
    );
    return {
      success: false,
      response: buildInfoResponse(
        "Failed to process your action. Please try again from the dashboard.",
      ),
    };
  }

  // Audit log (fire-and-forget).
  logAuditEvent({
    orgId: approval.org_id,
    userId: decidedBy ?? undefined,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: requestId,
    details: {
      decision,
      decision_source: "discord",
      decision_comment: comment ?? null,
      discord_user_id: discordUserId,
      discord_username: discordUsername,
    },
    ipAddress: getClientIp(request),
  });

  // Deliver callback if configured (fire-and-forget).
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

  return {
    success: true,
    approval: approval as Record<string, unknown>,
    updated: updated as Record<string, unknown>,
    newStatus,
  };
}

// ---------------------------------------------------------------------------
// POST /api/discord/interact
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    console.error("[Discord Interact] DISCORD_PUBLIC_KEY is not set");
    return NextResponse.json(
      { error: "Discord integration is not configured" },
      { status: 500 },
    );
  }

  // 1. Read the raw body.
  const rawBody = await request.text();

  // 2. Verify the Discord request signature (Ed25519).
  const signature = request.headers.get("X-Signature-Ed25519") ?? "";
  const timestamp = request.headers.get("X-Signature-Timestamp") ?? "";

  if (!signature || !timestamp) {
    return NextResponse.json(
      { error: "Missing signature headers" },
      { status: 401 },
    );
  }

  const isValid = await verifyDiscordSignature(
    publicKey,
    signature,
    timestamp,
    rawBody,
  );

  if (!isValid) {
    console.warn("[Discord Interact] Invalid Discord signature");
    return NextResponse.json(
      { error: "Invalid request signature" },
      { status: 401 },
    );
  }

  // 3. Parse the interaction payload.
  let interaction: DiscordInteraction;

  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // 4. Handle PING (required by Discord for endpoint verification).
  if (interaction.type === INTERACTION_TYPE.PING) {
    return NextResponse.json({ type: CALLBACK_TYPE.PONG });
  }

  // -------------------------------------------------------------------------
  // Handle MESSAGE_COMPONENT (button clicks) -- show the reason modal
  // -------------------------------------------------------------------------
  if (interaction.type === INTERACTION_TYPE.MESSAGE_COMPONENT) {
    const customId = interaction.data?.custom_id;
    if (!customId) {
      return NextResponse.json({ type: CALLBACK_TYPE.PONG });
    }

    const parts = customId.split(":");
    if (parts.length !== 3 || parts[0] !== "okrunit") {
      return NextResponse.json({ type: CALLBACK_TYPE.PONG });
    }

    const actionStr = parts[1];
    const requestId = parts[2];

    if (actionStr !== "approve" && actionStr !== "reject") {
      return NextResponse.json({ type: CALLBACK_TYPE.PONG });
    }

    // Validate the request exists and is still actionable.
    const admin = createAdminClient();
    const { data: approval, error: fetchError } = await admin
      .from("approval_requests")
      .select("id, status, expires_at, org_id, require_rejection_reason, priority, title")
      .eq("id", requestId)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        buildInfoResponse(
          "Approval request not found. It may have been deleted.",
        ),
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        buildInfoResponse(
          `This request has already been **${approval.status}**. No action taken.`,
        ),
      );
    }

    if (
      approval.expires_at &&
      new Date(approval.expires_at) < new Date()
    ) {
      await admin
        .from("approval_requests")
        .update({ status: "expired" })
        .eq("id", approval.id);

      return NextResponse.json(
        buildInfoResponse(
          "This request has expired and can no longer be actioned.",
        ),
      );
    }

    // Check whether to show the reason prompt.
    const { showPrompt, reasonRequired } =
      await getDecisionCommentPolicy(approval.org_id, actionStr, {
        require_rejection_reason: approval.require_rejection_reason,
        priority: approval.priority,
      });

    if (showPrompt) {
      // Show the modal.
      return NextResponse.json(
        buildReasonModal(actionStr, requestId, approval.title, reasonRequired),
      );
    }

    // Skip prompt — apply the decision immediately.
    const discordUser = interaction.member?.user ?? interaction.user;
    const discordUserId = discordUser?.id ?? "unknown";
    const discordUsername =
      discordUser?.global_name ?? discordUser?.username ?? "Discord User";

    const result = await applyDecision(request, {
      decision: actionStr,
      requestId,
      discordUserId,
      discordUsername,
    });

    if (!result.success) {
      return NextResponse.json(result.response);
    }

    return NextResponse.json(
      buildDecisionResponse(
        result.approval.title as string,
        result.newStatus,
        discordUsername,
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Handle MODAL_SUBMIT -- apply the decision with the reason
  // -------------------------------------------------------------------------
  if (interaction.type === INTERACTION_TYPE.MODAL_SUBMIT) {
    const customId = interaction.data?.custom_id;
    if (!customId) {
      return NextResponse.json({ type: CALLBACK_TYPE.PONG });
    }

    // Format: okrunit:modal:<action>:<requestId>
    const parts = customId.split(":");
    if (parts.length !== 4 || parts[0] !== "okrunit" || parts[1] !== "modal") {
      return NextResponse.json({ type: CALLBACK_TYPE.PONG });
    }

    const actionStr = parts[2];
    const requestId = parts[3];

    if (actionStr !== "approve" && actionStr !== "reject") {
      return NextResponse.json({ type: CALLBACK_TYPE.PONG });
    }

    // Extract the reason from the modal components.
    let reason: string | undefined;
    for (const row of interaction.data?.components ?? []) {
      for (const component of row.components ?? []) {
        if (component.custom_id === "reason" && component.value) {
          reason = component.value.trim();
        }
      }
    }

    // Resolve the Discord user.
    const discordUser = interaction.member?.user ?? interaction.user;
    const discordUserId = discordUser?.id ?? "unknown";
    const discordUsername =
      discordUser?.global_name ?? discordUser?.username ?? "Discord User";

    const result = await applyDecision(request, {
      decision: actionStr,
      requestId,
      discordUserId,
      discordUsername,
      comment: reason || undefined,
    });

    if (!result.success) {
      return NextResponse.json(result.response);
    }

    return NextResponse.json(
      buildDecisionResponse(
        result.approval.title as string,
        result.newStatus,
        discordUsername,
        reason || undefined,
      ),
    );
  }

  // Unknown interaction type.
  return NextResponse.json({ type: CALLBACK_TYPE.PONG });
}
