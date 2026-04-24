// ---------------------------------------------------------------------------
// OKrunit -- Microsoft Teams Interactive Callback Route
// ---------------------------------------------------------------------------
//
// Receives Action.Submit payloads from Teams Adaptive Cards when a user
// clicks "Approve" or "Reject".
//
// Supports two authentication modes:
// 1. Bot Framework JWT -- standard Microsoft Bot Framework token validation
// 2. HMAC Signature -- legacy mode using TEAMS_SIGNING_SECRET
//
// Flow:
//   1. User clicks Approve/Reject (Action.Submit with action + requestId)
//   2. If no comment field is present, return an updated card with a TextInput
//      and Submit button for the user to enter a reason
//   3. When submitted again with the comment field, apply the decision
//
// If a rejection reason is required, the TextInput is marked as required
// and there is no "Skip" option.
// ---------------------------------------------------------------------------

import { createHmac, createPublicKey, createVerify, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";
import { getDecisionCommentPolicy } from "@/lib/api/rejection-reason";
import { logger } from "@/lib/monitoring/logger";
import { titleCaseName } from "@/lib/format-name";
import {
  canUserDecideServerSide,
  resolveMessagingUser,
} from "@/lib/approvals/can-decide-server";
import { createLinkNonce } from "@/lib/messaging/link-nonces";

// ---------------------------------------------------------------------------
// Bot Framework Auth Constants
// ---------------------------------------------------------------------------

const TEAMS_CLIENT_ID = process.env.TEAMS_CLIENT_ID;

const BOT_FRAMEWORK_JWKS_URL =
  "https://login.botframework.com/v1/.well-known/keys";

// Cache JWKS keys with a TTL of 24 hours
let cachedKeys: JsonWebKey[] | null = null;
let cachedKeysAt = 0;
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface JwksResponse {
  keys: JsonWebKey[];
}

interface JsonWebKey {
  kty: string;
  kid?: string;
  n?: string;
  e?: string;
  use?: string;
  alg?: string;
  x5c?: string[];
}

async function getJWKS(): Promise<JsonWebKey[]> {
  if (cachedKeys && Date.now() - cachedKeysAt < JWKS_CACHE_TTL_MS) {
    return cachedKeys;
  }

  const res = await fetch(BOT_FRAMEWORK_JWKS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status}`);
  }

  const data: JwksResponse = await res.json();
  cachedKeys = data.keys;
  cachedKeysAt = Date.now();
  return data.keys;
}

// ---------------------------------------------------------------------------
// Signature Verification (legacy HMAC mode)
// ---------------------------------------------------------------------------

function verifyTeamsSignature(
  signingSecret: string,
  rawBody: string,
  expectedSignature: string,
): boolean {
  const computed = `sha256=${createHmac("sha256", signingSecret).update(rawBody).digest("hex")}`;

  const a = Buffer.from(computed, "utf-8");
  const b = Buffer.from(expectedSignature, "utf-8");

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Bot Framework JWT Verification
// ---------------------------------------------------------------------------

/**
 * Decode a base64url string to a Buffer.
 */
function base64UrlDecode(str: string): Buffer {
  // Replace base64url chars with base64 equivalents and add padding
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

/**
 * Verify a Bot Framework JWT token from the Authorization header.
 * Returns true if the token is valid and issued for our bot.
 *
 * Uses Node.js built-in crypto (no external JWT library required).
 */
async function verifyBotFrameworkToken(
  authHeader: string,
): Promise<boolean> {
  if (!TEAMS_CLIENT_ID) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Decode header to find the key ID
    const header = JSON.parse(base64UrlDecode(parts[0]).toString("utf-8"));
    const kid = header.kid as string | undefined;
    const alg = header.alg as string | undefined;

    if (!alg || !alg.startsWith("RS")) {
      logger.warn("[Teams Interact] Unsupported JWT algorithm:", alg);
      return false;
    }

    // Fetch JWKS and find the matching key
    const keys = await getJWKS();
    const key = kid
      ? keys.find((k) => k.kid === kid)
      : keys.find((k) => k.kty === "RSA" && k.use === "sig");

    if (!key) {
      logger.warn("[Teams Interact] No matching JWK found for kid:", kid);
      return false;
    }

    // Build a public key from the JWK
    let publicKey;
    if (key.x5c && key.x5c.length > 0) {
      // Use the X.509 certificate if available
      const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
      publicKey = createPublicKey(cert);
    } else if (key.n && key.e) {
      // Build from RSA components
      publicKey = createPublicKey({
        key: {
          kty: "RSA",
          n: key.n,
          e: key.e,
        },
        format: "jwk",
      });
    } else {
      logger.warn("[Teams Interact] JWK missing key material");
      return false;
    }

    // Verify the signature
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signature = base64UrlDecode(parts[2]);

    // Map JWT algorithm to Node.js algorithm name
    const nodeAlg = alg === "RS256" ? "RSA-SHA256" : alg === "RS384" ? "RSA-SHA384" : "RSA-SHA512";

    const verifier = createVerify(nodeAlg);
    verifier.update(signingInput);
    const isValid = verifier.verify(publicKey, signature);

    if (!isValid) {
      logger.warn("[Teams Interact] JWT signature verification failed");
      return false;
    }

    // Decode and validate claims
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf-8"));

    // Check issuer
    if (payload.iss !== "https://api.botframework.com") {
      logger.warn("[Teams Interact] JWT issuer mismatch:", payload.iss);
      return false;
    }

    // Check audience
    if (payload.aud !== TEAMS_CLIENT_ID) {
      logger.warn("[Teams Interact] JWT audience mismatch:", payload.aud);
      return false;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      logger.warn("[Teams Interact] JWT has expired");
      return false;
    }

    // Check not-before
    if (payload.nbf && payload.nbf > now + 300) {
      // Allow 5 min clock skew
      logger.warn("[Teams Interact] JWT not yet valid");
      return false;
    }

    return true;
  } catch (err) {
    logger.warn("[Teams Interact] Bot Framework JWT verification failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an Adaptive Card message showing the decision result. */
function buildResponseCard(
  title: string,
  decision: string,
  userName: string,
  comment?: string,
): object {
  const isApproved = decision === "approved";
  const statusEmoji = isApproved ? "\u2705" : "\u274C";
  const statusLabel = isApproved ? "Approved" : "Rejected";

  const bodyItems: object[] = [
    {
      type: "TextBlock",
      text: `${statusEmoji} ${statusLabel}: **${title}**`,
      wrap: true,
      weight: "Bolder",
    },
    {
      type: "TextBlock",
      text: `by ${userName}`,
      wrap: true,
      isSubtle: true,
      size: "Small",
    },
  ];

  if (comment) {
    bodyItems.push({
      type: "TextBlock",
      text: `Reason: ${comment}`,
      wrap: true,
      isSubtle: true,
      size: "Small",
    });
  }

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
        },
      },
    ],
  };
}

/** Build an error Adaptive Card. */
function buildErrorCard(message: string): object {
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
          body: [
            {
              type: "TextBlock",
              text: `\u26A0\uFE0F ${message}`,
              wrap: true,
            },
          ],
        },
      },
    ],
  };
}

/**
 * Build an Adaptive Card that prompts for a reason before applying.
 */
function buildReasonPromptCard(
  title: string,
  action: string,
  requestId: string,
  reasonRequired: boolean,
): object {
  const actionLabel = action === "approve" ? "approval" : "rejection";

  const bodyItems: object[] = [
    {
      type: "TextBlock",
      text: `Would you like to add a reason for your ${actionLabel}?`,
      wrap: true,
      weight: "Bolder",
    },
    {
      type: "TextBlock",
      text: `**${title}**`,
      wrap: true,
    },
    {
      type: "Input.Text",
      id: "comment",
      placeholder: "Enter your reason here...",
      isMultiline: true,
      isRequired: reasonRequired,
      label: `Reason for ${actionLabel}`,
      errorMessage: reasonRequired
        ? `A reason is required for this ${actionLabel}.`
        : undefined,
    },
  ];

  const actions: object[] = [
    {
      type: "Action.Submit",
      title: `Submit ${action === "approve" ? "Approval" : "Rejection"}`,
      data: {
        action,
        requestId,
        hasComment: true,
      },
    },
  ];

  // Only show "Skip" if reason is not required.
  if (!reasonRequired) {
    actions.push({
      type: "Action.Submit",
      title: "Skip",
      data: {
        action,
        requestId,
        hasComment: true,
        skipReason: true,
      },
    });
  }

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
          actions,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Bot Framework Activity Types
// ---------------------------------------------------------------------------

interface BotFrameworkActivity {
  type: string;
  action?: string;
  serviceUrl?: string;
  channelId?: string;
  conversation?: {
    id: string;
    tenantId?: string;
    conversationType?: string;
    isGroup?: boolean;
    name?: string;
  };
  from?: {
    id?: string;
    name?: string;
    aadObjectId?: string;
  };
  recipient?: {
    id?: string;
    name?: string;
  };
  membersAdded?: Array<{
    id?: string;
    name?: string;
  }>;
  value?: {
    action?: string;
    requestId?: string;
    comment?: string;
    hasComment?: boolean;
    skipReason?: boolean;
  };
  text?: string;
  replyToId?: string;
}

// ---------------------------------------------------------------------------
// POST /api/teams/interact
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Read the raw body.
  const rawBody = await request.text();

  // 2. Determine authentication mode and verify.
  const authHeader = request.headers.get("Authorization") ?? "";
  const signingSecret = process.env.TEAMS_SIGNING_SECRET;
  let authenticated = false;

  // Try Bot Framework JWT first (production mode)
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    authenticated = await verifyBotFrameworkToken(authHeader);
    if (!authenticated) {
      logger.warn("[Teams Interact] Bot Framework JWT auth failed");
      return NextResponse.json(
        { error: "Invalid authorization token" },
        { status: 401 },
      );
    }
  }
  // Fall back to legacy HMAC signature verification
  else if (signingSecret) {
    const signature = request.headers.get("X-OKrunit-Signature") ?? "";
    if (!verifyTeamsSignature(signingSecret, rawBody, signature)) {
      logger.warn("[Teams Interact] Invalid HMAC signature");
      return NextResponse.json(
        { error: "Invalid request signature" },
        { status: 401 },
      );
    }
    authenticated = true;
  }

  // Always require one of the two auth modes to have succeeded. The
  // previous code allowed unauthenticated requests in non-production
  // environments, which meant a staging/self-hosted deploy with
  // NODE_ENV=development accepted forged Adaptive Card submits.
  if (!authenticated) {
    if (!signingSecret && !TEAMS_CLIENT_ID) {
      return NextResponse.json(
        { error: "Teams authentication not configured" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 },
    );
  }

  // 3. Parse the JSON payload.
  let activity: BotFrameworkActivity;

  try {
    activity = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  // 4. Handle Bot Framework conversationUpdate activities (bot added/removed).
  if (activity.type === "conversationUpdate") {
    return handleConversationUpdate(activity);
  }

  // 5. Handle message activities (Adaptive Card Action.Submit).
  if (activity.type === "message" || activity.type === "invoke") {
    return handleActionSubmit(request, activity);
  }

  // Unknown activity type -- acknowledge without error.
  return NextResponse.json({ ok: true, message: "Activity type not handled" });
}

// ---------------------------------------------------------------------------
// Handle conversationUpdate (bot added to team/channel)
// ---------------------------------------------------------------------------

async function handleConversationUpdate(
  activity: BotFrameworkActivity,
): Promise<NextResponse> {
  const botId = activity.recipient?.id;
  const membersAdded = activity.membersAdded ?? [];

  // Check if the bot itself was added
  const botWasAdded = membersAdded.some((m) => m.id === botId);

  if (!botWasAdded) {
    // Some other member was added -- not relevant to us
    return NextResponse.json({ ok: true });
  }

  // Store the conversation reference for proactive messaging
  const conversationId = activity.conversation?.id;
  const serviceUrl = activity.serviceUrl;
  const _tenantId = activity.conversation?.tenantId;

  if (!conversationId || !serviceUrl) {
    logger.warn("[Teams Interact] conversationUpdate missing conversation data");
    return NextResponse.json({ ok: true });
  }

  // Store the conversation reference in the database.
  // This is stored as metadata that the proactive messaging system can use.
  const admin = createAdminClient();

  // We store the conversation reference as a messaging connection.
  // The channel_id is the conversation ID, and metadata holds the service URL.
  const _conversationName =
    activity.conversation?.name ?? `Teams conversation`;

  // Check if a connection already exists for this conversation
  const { data: existing } = await admin
    .from("messaging_connections")
    .select("id, org_id")
    .eq("platform", "teams")
    .eq("channel_id", conversationId)
    .maybeSingle();

  if (existing) {
    // Update the existing connection with fresh service URL
    await admin
      .from("messaging_connections")
      .update({
        webhook_url: serviceUrl,
        is_active: true,
      })
      .eq("id", existing.id);

  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Handle Action.Submit from Adaptive Cards
// ---------------------------------------------------------------------------

async function handleActionSubmit(
  request: Request,
  activity: BotFrameworkActivity,
): Promise<NextResponse> {
  // Extract action data -- Bot Framework puts card submit data in activity.value
  const actionData = activity.value;

  if (!actionData?.action || !actionData?.requestId) {
    return NextResponse.json({ ok: true, message: "No action to process" });
  }

  const actionType = actionData.action;
  const requestId = actionData.requestId;

  let decision: "approve" | "reject";
  if (actionType === "approve") {
    decision = "approve";
  } else if (actionType === "reject") {
    decision = "reject";
  } else {
    return NextResponse.json({ ok: true, message: "Unknown action" });
  }

  const teamsUserId = activity.from?.id ?? "unknown";
  const teamsUserName = activity.from?.name ?? "Teams User";

  const admin = createAdminClient();

  // 5. Fetch the approval request.
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !approval) {
    return NextResponse.json(
      buildErrorCard(
        "Approval request not found. It may have been deleted.",
      ),
    );
  }

  // 6. Check that the request is still pending. Stale-click cleanup: when
  // someone clicks a button on a message for a now-decided request, we
  // show who decided and when so the answer is clear inline.
  if (approval.status !== "pending") {
    const statusLabel =
      approval.status.charAt(0).toUpperCase() + approval.status.slice(1);
    let decidedByName = "";
    if (approval.decided_by) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", approval.decided_by)
        .maybeSingle();
      decidedByName = titleCaseName(profile?.full_name) || profile?.email || "";
    }
    const byLine = decidedByName ? ` by ${decidedByName}` : "";
    const commentLine = approval.decision_comment
      ? `\n\n_${approval.decision_comment}_`
      : "";
    return NextResponse.json(
      buildErrorCard(
        `${statusLabel}${byLine}.${commentLine}`,
      ),
    );
  }

  // 7. Check for lazy expiration.
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);

    return NextResponse.json(
      buildErrorCard(
        "This request has expired and can no longer be actioned.",
      ),
    );
  }

  // Permission enforcement: resolve the Teams user to an OKrunit user,
  // then run the shared server-side permission pipeline (assigned approvers,
  // sequential turn, self-approval block, four-eyes, delegation).
  const resolved = await resolveMessagingUser(admin, {
    orgId: approval.org_id,
    platform: "teams",
    externalUserId: teamsUserId,
  });
  if (!resolved) {
    const { url } = await createLinkNonce({
      orgId: approval.org_id,
      platform: "teams",
      externalUserId: teamsUserId,
      externalUsername: teamsUserName,
    });
    return NextResponse.json(
      buildErrorCard(
        `Your Teams account isn't linked yet. Connect it here: ${url} (expires in 10 minutes).`,
      ),
    );
  }
  const eligibility = await canUserDecideServerSide(admin, {
    approval,
    actorUserId: resolved.userId,
    membershipRole: resolved.role,
  });
  if (!eligibility.ok) {
    return NextResponse.json(buildErrorCard(eligibility.reason));
  }

  // -------------------------------------------------------------------------
  // If this is the first submit (no hasComment flag), show the reason prompt
  // (unless the org has opted to skip it)
  // -------------------------------------------------------------------------
  if (!actionData.hasComment) {
    const { showPrompt, reasonRequired } =
      await getDecisionCommentPolicy(approval.org_id, decision, {
        require_rejection_reason: approval.require_rejection_reason,
        priority: approval.priority,
      });

    if (showPrompt) {
      return NextResponse.json(
        buildReasonPromptCard(
          approval.title,
          decision,
          requestId,
          reasonRequired,
        ),
      );
    }
    // Fall through to apply immediately when prompt is skipped.
  }

  // -------------------------------------------------------------------------
  // Second submit: apply the decision with the comment
  // -------------------------------------------------------------------------
  const comment =
    actionData.skipReason ? undefined : actionData.comment?.trim() || undefined;

  // Enforce rejection-reason-required on the second submit (for the case
  // where the user checked "skip reason" but the org policy requires one).
  if (decision === "reject") {
    const { reasonRequired } = await getDecisionCommentPolicy(
      approval.org_id,
      "reject",
      {
        require_rejection_reason: approval.require_rejection_reason,
        priority: approval.priority,
      },
    );
    if (reasonRequired && !comment) {
      return NextResponse.json(
        buildErrorCard("A rejection reason is required for this request."),
      );
    }
  }

  // 8. Apply the decision.
  const newStatus = decision === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();
  const decidedBy = resolved.userId;

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    decided_by: decidedBy,
    decided_at: decidedAt,
    decision_source: "teams",
  };
  if (eligibility.ok && eligibility.delegatedFrom) {
    updatePayload.delegated_from = eligibility.delegatedFrom;
  }

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
    logger.error("[Teams Interact] Failed to update approval:", updateError);
    return NextResponse.json(
      buildErrorCard(
        "Failed to process your action. Please try again from the dashboard.",
      ),
    );
  }

  // 9. Audit log (fire-and-forget).
  logAuditEvent({
    orgId: approval.org_id,
    userId: decidedBy ?? undefined,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: requestId,
    details: {
      decision,
      decision_source: "teams",
      decision_comment: comment ?? null,
      teams_user_id: teamsUserId,
      teams_user_name: teamsUserName,
    },
    ipAddress: getClientIp(request),
  });

  // 10. Deliver callback if configured (fire-and-forget).
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

  // 11. Return an updated card that replaces the original.
  return NextResponse.json(
    buildResponseCard(approval.title, newStatus, teamsUserName, comment),
  );
}
