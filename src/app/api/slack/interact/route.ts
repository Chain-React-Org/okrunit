// ---------------------------------------------------------------------------
// OKrunit -- Slack Interactive Callback Route
// ---------------------------------------------------------------------------
//
// Receives interactive message payloads from Slack when a user clicks an
// "Approve" or "Reject" button, or submits a modal view with a reason.
//
// Flow:
//   1. User clicks Approve/Reject button (block_actions)
//   2. Bot opens a modal view with a text input for the reason
//   3. User submits the modal (view_submission) -> decision is applied
//
// Slack sends these as POST requests with form-encoded body where the
// actual payload is in the "payload" field as a JSON string.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, after } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";
import { getDecisionCommentPolicy } from "@/lib/api/rejection-reason";

// ---------------------------------------------------------------------------
// Signature Verification
// ---------------------------------------------------------------------------

const SLACK_SIGNATURE_VERSION = "v0";
const MAX_TIMESTAMP_DRIFT_SECONDS = 5 * 60;

function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  expectedSignature: string,
): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_SECONDS) {
    return false;
  }

  const sigBasestring = `${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  const computedSignature =
    SLACK_SIGNATURE_VERSION +
    "=" +
    createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  const a = Buffer.from(computedSignature, "utf-8");
  const b = Buffer.from(expectedSignature, "utf-8");

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decisionDisplay(decision: string): string {
  const map: Record<string, string> = {
    approved: ":white_check_mark: Approved",
    rejected: ":x: Rejected",
  };
  return map[decision] ?? decision;
}

function buildResponseBlocks(
  title: string,
  decision: string,
  slackUser: string,
  comment?: string,
): object[] {
  const commentLine = comment ? `\n_Reason: ${comment}_` : "";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${decisionDisplay(decision)} *${title}*\n_by <@${slackUser}>_${commentLine}`,
      },
    },
  ];
}

/**
 * Open a Slack modal view using the trigger_id from the button interaction.
 */
async function openSlackModal(params: {
  triggerId: string;
  action: string;
  requestId: string;
  title: string;
  reasonRequired: boolean;
  responseUrl?: string;
}): Promise<boolean> {
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (!slackToken) {
    console.error("[Slack Interact] SLACK_BOT_TOKEN is not set");
    return false;
  }

  const actionLabel = params.action === "approve" ? "Approval" : "Rejection";

  const view = {
    type: "modal",
    callback_id: "okrunit_reason_modal",
    private_metadata: JSON.stringify({
      action: params.action,
      requestId: params.requestId,
      responseUrl: params.responseUrl,
    }),
    title: {
      type: "plain_text",
      text: `${actionLabel} Reason`,
    },
    submit: {
      type: "plain_text",
      text: `Submit ${actionLabel}`,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `You are about to *${params.action}* the request:\n*${params.title}*`,
        },
      },
      {
        type: "input",
        block_id: "reason_block",
        optional: !params.reasonRequired,
        element: {
          type: "plain_text_input",
          action_id: "reason_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Enter your reason here...",
          },
        },
        label: {
          type: "plain_text",
          text: `Reason for ${actionLabel.toLowerCase()}`,
        },
      },
    ],
  };

  try {
    const response = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${slackToken}`,
      },
      body: JSON.stringify({
        trigger_id: params.triggerId,
        view,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error("[Slack Interact] Failed to open modal:", result.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Slack Interact] Error opening modal:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core: Apply the decision
// ---------------------------------------------------------------------------

async function applyDecisionAndRespond(request: Request, params: {
  decision: "approve" | "reject";
  requestId: string;
  slackUserId: string;
  slackUsername: string;
  comment?: string;
}): Promise<
  | { response_action: string }
  | { approval: Record<string, unknown>; updated: Record<string, unknown>; newStatus: string; slackUserId: string }
> {
  const { decision, requestId, slackUserId, slackUsername, comment } = params;
  const admin = createAdminClient();

  // Fetch the approval request.
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !approval) {
    return {
      response_action: "clear",
    };
  }

  if (approval.status !== "pending") {
    return {
      response_action: "clear",
    };
  }

  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);

    return {
      response_action: "clear",
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
    decision_source: "slack",
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
    console.error("[Slack Interact] Failed to update approval:", updateError);
    return {
      response_action: "clear",
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
      decision_source: "slack",
      decision_comment: comment ?? null,
      slack_user_id: slackUserId,
      slack_username: slackUsername,
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

  // For view_submission, we update the original message via response_url
  // if available, or just close the modal. The original message update
  // is handled separately below.
  return {
    approval,
    updated,
    newStatus,
    slackUserId,
  };
}

// ---------------------------------------------------------------------------
// POST /api/slack/interact
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    console.error("[Slack Interact] SLACK_SIGNING_SECRET is not set");
    return NextResponse.json(
      { error: "Slack integration is not configured" },
      { status: 500 },
    );
  }

  // 1. Read the raw body (form-encoded).
  const rawBody = await request.text();

  // 2. Verify the Slack request signature.
  const timestamp = request.headers.get("X-Slack-Request-Timestamp") ?? "";
  const slackSignature = request.headers.get("X-Slack-Signature") ?? "";

  if (
    !verifySlackSignature(signingSecret, timestamp, rawBody, slackSignature)
  ) {
    console.warn("[Slack Interact] Invalid Slack signature");
    return NextResponse.json(
      { error: "Invalid request signature" },
      { status: 401 },
    );
  }

  // 3. Parse the payload from the form-encoded body.
  const formData = new URLSearchParams(rawBody);
  const payloadStr = formData.get("payload");

  if (!payloadStr) {
    return NextResponse.json(
      { error: "Missing payload" },
      { status: 400 },
    );
  }

  let payload: {
    type: string;
    trigger_id?: string;
    response_url?: string;
    user?: { id: string; username?: string; name?: string };
    actions?: Array<{
      action_id: string;
      value: string;
    }>;
    view?: {
      callback_id?: string;
      private_metadata?: string;
      state?: {
        values?: Record<
          string,
          Record<string, { value?: string | null }>
        >;
      };
    };
    message?: { blocks?: unknown[] };
  };

  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json(
      { error: "Invalid payload JSON" },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------------
  // Handle block_actions (button clicks) -- open the reason modal
  // -------------------------------------------------------------------------
  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    if (!action) {
      return NextResponse.json({ ok: true });
    }

    let decision: "approve" | "reject";
    if (action.action_id === "okrunit_approve") {
      decision = "approve";
    } else if (action.action_id === "okrunit_reject") {
      decision = "reject";
    } else {
      // Not our action, just acknowledge.
      return NextResponse.json({ ok: true });
    }

    const requestId = action.value;
    const responseUrl = payload.response_url;
    const slackUserId = payload.user?.id ?? "unknown";
    const slackUsername = payload.user?.username ?? payload.user?.name ?? "Slack User";
    const triggerId = payload.trigger_id;

    // Acknowledge immediately (Slack requires response within 3 seconds).
    // All processing happens in the background via response_url.
    const backgroundProcess = async () => {
      try {
        const admin = createAdminClient();
        const { data: approval, error: fetchError } = await admin
          .from("approval_requests")
          .select("id, status, expires_at, org_id, require_rejection_reason, priority, title, callback_url, callback_headers, connection_id, metadata")
          .eq("id", requestId)
          .single();

        if (fetchError || !approval || approval.status !== "pending") {
          if (responseUrl) {
            await fetch(responseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                replace_original: true,
                blocks: [{
                  type: "section",
                  text: { type: "mrkdwn", text: !approval ? ":warning: Request not found." : `:information_source: Already ${approval.status}.` },
                }],
              }),
            });
          }
          return;
        }

        // Check whether to show the reason prompt.
        const { showPrompt, reasonRequired } =
          await getDecisionCommentPolicy(approval.org_id, decision, {
            require_rejection_reason: approval.require_rejection_reason,
            priority: approval.priority,
          });

        if (showPrompt && triggerId) {
          await openSlackModal({
            triggerId,
            action: decision,
            requestId,
            title: approval.title,
            reasonRequired,
            responseUrl: responseUrl ?? undefined,
          });
          return;
        }

        // Skip prompt — apply the decision immediately.
        const result = await applyDecisionAndRespond(request, {
          decision,
          requestId,
          slackUserId,
          slackUsername,
        });

        if ("response_action" in result) {
          return;
        }

        // Update the original message.
        if (responseUrl) {
          await fetch(responseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              replace_original: true,
              blocks: buildResponseBlocks(approval.title, decision, slackUsername),
            }),
          });
        }
      } catch (err) {
        console.error("[Slack Interact] Background processing error:", err);
      }
    };

    // Process in background after responding to Slack.
    after(backgroundProcess);

    // Return 200 immediately to Slack.
    return new NextResponse("", { status: 200 });
  }

  // -------------------------------------------------------------------------
  // Handle view_submission (modal submit) -- apply the decision
  // -------------------------------------------------------------------------
  if (payload.type === "view_submission") {
    const view = payload.view;
    if (!view || view.callback_id !== "okrunit_reason_modal") {
      return NextResponse.json({ ok: true });
    }

    // Extract action and requestId from private_metadata.
    let metadata: { action?: string; requestId?: string; responseUrl?: string };
    try {
      metadata = JSON.parse(view.private_metadata ?? "{}");
    } catch {
      console.error("[Slack Interact] Invalid private_metadata in modal");
      return NextResponse.json({ response_action: "clear" });
    }

    if (!metadata.action || !metadata.requestId) {
      return NextResponse.json({ response_action: "clear" });
    }

    const decision = metadata.action as "approve" | "reject";
    const requestId = metadata.requestId;
    const originalResponseUrl = metadata.responseUrl;

    // Extract the reason from the view state.
    const reason =
      view.state?.values?.reason_block?.reason_input?.value?.trim() ||
      undefined;

    const slackUserId = payload.user?.id ?? "unknown";
    const slackUsername =
      payload.user?.username ?? payload.user?.name ?? "Slack User";

    const result = await applyDecisionAndRespond(request, {
      decision,
      requestId,
      slackUserId: slackUserId,
      slackUsername: slackUsername,
      comment: reason,
    });

    // If the result has response_action, it's an error case.
    if ("response_action" in result) {
      return NextResponse.json(result);
    }

    // Update the original message via response_url if available.
    const responseUrl = originalResponseUrl ?? payload.response_url;
    if (responseUrl) {
      const newStatus = result.newStatus as string;
      const approvalData = result.approval as Record<string, unknown>;

      try {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replace_original: true,
            blocks: buildResponseBlocks(
              approvalData.title as string,
              newStatus,
              slackUserId,
              reason,
            ),
          }),
        });
      } catch (err) {
        console.error(
          "[Slack Interact] Failed to update original message:",
          err,
        );
      }
    }

    // Close the modal.
    return NextResponse.json({ response_action: "clear" });
  }

  // Unknown payload type -- acknowledge.
  return NextResponse.json({ ok: true });
}
