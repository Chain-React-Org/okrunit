// ---------------------------------------------------------------------------
// OKrunit -- Twilio SMS Webhook Route
// ---------------------------------------------------------------------------
//
// Receives inbound SMS messages from Twilio when users reply to an SMS
// notification. Supports reply-based approve/reject decisions.
//
// Flow:
//   1. User receives SMS: "OKRunit: Deploy v1.2 needs your approval.
//      Reply APPROVE or REJECT."
//   2. User replies with APPROVE, REJECT, or SKIP
//   3. This handler looks up the user by phone number
//   4. Finds their most recent pending approval and applies the decision
//   5. Responds with TwiML confirming the action
//
// Twilio sends POST with form-encoded body: From, Body, MessageSid, etc.
// We validate the request signature using the X-Twilio-Signature header.
//
// Required env vars:
//   TWILIO_AUTH_TOKEN  -- used for signature validation
// ---------------------------------------------------------------------------

import { createHmac } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";

// ---------------------------------------------------------------------------
// Twilio Signature Validation
// ---------------------------------------------------------------------------

/**
 * Validate the Twilio request signature using HMAC-SHA1.
 *
 * Algorithm:
 * 1. Take the full URL of the request
 * 2. Sort the POST parameters alphabetically by key
 * 3. Concatenate the URL with all key+value pairs
 * 4. HMAC-SHA1 the result with TWILIO_AUTH_TOKEN
 * 5. Base64-encode and compare to X-Twilio-Signature header
 */
function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  // Sort parameters alphabetically by key and concatenate key+value
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = createHmac("sha1", authToken)
    .update(data, "utf-8")
    .digest("base64");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// TwiML Response Helper
// ---------------------------------------------------------------------------

function twimlResponse(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function twimlEmpty(): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// POST /api/twilio/webhook
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[Twilio Webhook] TWILIO_AUTH_TOKEN is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Parse the form-encoded body
  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const pair of rawBody.split("&")) {
    const [key, value] = pair.split("=").map(decodeURIComponent);
    if (key && value !== undefined) {
      params[key] = value;
    }
  }

  // Validate Twilio signature
  const twilioSignature = request.headers.get("X-Twilio-Signature") ?? "";
  const requestUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/webhook`
      : request.url;

  if (!twilioSignature) {
    console.warn("[Twilio Webhook] Missing Twilio signature header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!validateTwilioSignature(authToken, requestUrl, params, twilioSignature)) {
    console.warn("[Twilio Webhook] Invalid Twilio signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromNumber = params.From;
  const messageBody = (params.Body ?? "").trim().toUpperCase();

  if (!fromNumber || !messageBody) {
    return twimlEmpty();
  }

  // Look up the user by phone number
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, email, full_name")
    .eq("phone_number", fromNumber)
    .maybeSingle();

  if (profileError || !profile) {
    console.warn(
      `[Twilio Webhook] No user found for phone number ${fromNumber}`,
    );
    return twimlResponse(
      "No OKRunit account is linked to this phone number.",
    );
  }

  // Parse the command: APPROVE, REJECT, or SKIP
  let decision: "approve" | "reject" | null = null;
  if (messageBody === "APPROVE" || messageBody === "YES" || messageBody === "Y") {
    decision = "approve";
  } else if (messageBody === "REJECT" || messageBody === "NO" || messageBody === "N") {
    decision = "reject";
  } else if (messageBody === "SKIP") {
    return twimlResponse("Skipped. No action taken.");
  } else {
    return twimlResponse(
      "Reply APPROVE or REJECT to act on your most recent pending approval.",
    );
  }

  // Find the user's most recent pending approval request
  // First, get all orgs the user belongs to
  const { data: memberships } = await admin
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", profile.id);

  if (!memberships || memberships.length === 0) {
    return twimlResponse("You have no pending approval requests.");
  }

  const orgIds = memberships.map((m) => m.org_id);

  const { data: approval, error: approvalError } = await admin
    .from("approval_requests")
    .select("*")
    .in("org_id", orgIds)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvalError || !approval) {
    return twimlResponse("You have no pending approval requests.");
  }

  // Check if expired
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);
    return twimlResponse(
      `"${approval.title}" has expired and can no longer be actioned.`,
    );
  }

  // Apply the decision
  const newStatus = decision === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();
  const displayName = profile.full_name || profile.email || profile.id;

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    decided_by: profile.id,
    decided_at: decidedAt,
    decision_source: "sms",
  };

  const { data: updated, error: updateError } = await admin
    .from("approval_requests")
    .update(updatePayload)
    .eq("id", approval.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[Twilio Webhook] Update failed:", updateError);
    return twimlResponse(
      "Failed to process your decision. The request may have already been actioned.",
    );
  }

  // Audit log (fire-and-forget)
  logAuditEvent({
    orgId: approval.org_id,
    userId: profile.id,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: approval.id,
    details: {
      decision,
      decision_source: "sms",
      from_number: fromNumber,
      twilio_message_sid: params.MessageSid ?? null,
    },
    ipAddress: getClientIp(request),
  });

  // Deliver callback if configured (fire-and-forget)
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

  const emoji = newStatus === "approved" ? "Approved" : "Rejected";
  return twimlResponse(
    `${emoji}: "${approval.title}" by ${displayName}.`,
  );
}
