// ---------------------------------------------------------------------------
// OKrunit -- Token Action Route (One-Click Approve/Reject from Teams/Email)
// ---------------------------------------------------------------------------
//
// POST /api/v1/token-action
//
// Accepts a single-use action token and applies the approve/reject decision.
// Used by the /approve/[token] and /reject/[token] confirmation pages. The
// token itself serves as authentication (same security model as email links).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { validateAndConsumeToken } from "@/lib/notifications/tokens";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp, checkIpRateLimit, rateLimitResponse, AUTH_RATE_LIMIT } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";

// ---------------------------------------------------------------------------
// POST /api/v1/token-action
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`token-action:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: { token?: string; action?: string; comment?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { token, action, comment } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid token" },
      { status: 400 },
    );
  }

  if (!action || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 400 },
    );
  }

  // 1. Validate and consume the token (single-use).
  const tokenAction = await validateAndConsumeToken(token);

  if (!tokenAction) {
    return NextResponse.json(
      { error: "Token is invalid, expired, or already used" },
      { status: 410 },
    );
  }

  // Verify the token action matches the requested action.
  if (tokenAction.action !== action) {
    return NextResponse.json(
      { error: "Token action does not match requested action" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // 2. Fetch the approval request.
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", tokenAction.requestId)
    .single();

  if (fetchError || !approval) {
    return NextResponse.json(
      { error: "Approval request not found" },
      { status: 404 },
    );
  }

  // 3. Check that the request is still pending.
  if (approval.status !== "pending") {
    return NextResponse.json(
      {
        error: `Request is already ${approval.status}`,
        status: approval.status,
      },
      { status: 409 },
    );
  }

  // 4. Check for lazy expiration.
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);

    return NextResponse.json(
      { error: "Request has expired" },
      { status: 410 },
    );
  }

  // 5. Check approval permission for the user (skip for org-level tokens).
  // Teams tokens use the orgId as user_id -- these are org-wide so we skip
  // the per-user permission check. The confirmation page is public and
  // anyone with the token can act.
  const isOrgToken = tokenAction.userId === approval.org_id;

  if (!isOrgToken) {
    const { data: membership } = await admin
      .from("org_memberships")
      .select("can_approve")
      .eq("user_id", tokenAction.userId)
      .eq("org_id", approval.org_id)
      .maybeSingle();

    if (!membership?.can_approve) {
      return NextResponse.json(
        { error: "You do not have approval permissions" },
        { status: 403 },
      );
    }
  }

  // 6. Apply the decision.
  const newStatus = action === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();

  // Determine decision source based on token context.
  // Teams tokens use org ID as user_id; email tokens use actual user IDs.
  const decisionSource = isOrgToken ? "teams" : "email";

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    decided_by: isOrgToken ? null : tokenAction.userId,
    decided_at: decidedAt,
    decision_source: decisionSource,
  };

  if (comment && comment.trim()) {
    updatePayload.decision_comment = comment.trim();
  }

  const { data: updated, error: updateError } = await admin
    .from("approval_requests")
    .update(updatePayload)
    .eq("id", approval.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    console.error("[TokenAction] Failed to update approval request:", updateError);
    return NextResponse.json(
      { error: "Failed to process decision" },
      { status: 500 },
    );
  }

  // 7. Audit log (fire-and-forget).
  logAuditEvent({
    orgId: approval.org_id,
    userId: isOrgToken ? undefined : tokenAction.userId,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: approval.id,
    ipAddress: getClientIp(request),
    details: {
      decision: action,
      decision_source: decisionSource,
      comment: comment?.trim() || null,
    },
  });

  // 8. Deliver callback if configured (fire-and-forget).
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

  return NextResponse.json({
    success: true,
    requestId: approval.id,
    status: newStatus,
    title: approval.title,
  });
}
