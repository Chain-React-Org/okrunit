// ---------------------------------------------------------------------------
// OKrunit -- GitHub Webhook Handler
//
// Receives GitHub webhook events for pull_request actions:
//   - opened / synchronize: Create an OKrunit approval + GitHub check run
//   - closed: Cancel the associated pending approval
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import {
  verifyWebhookSignature,
  createCheckRun,
} from "@/lib/api/github";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PullRequestEvent {
  action: string;
  number: number;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
    head: { sha: string; ref: string };
    base: { ref: string };
    body: string | null;
    merged: boolean;
  };
  repository: {
    full_name: string;
  };
  installation?: {
    id: number;
  };
}

// ---------------------------------------------------------------------------
// POST /api/github/webhook
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Read the raw body for signature verification
    const rawBody = await request.text();

    // 2. Verify webhook signature
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    // 3. Parse event type
    const eventType = request.headers.get("x-github-event");
    if (eventType !== "pull_request") {
      // Acknowledge other events without processing
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }

    const event = JSON.parse(rawBody) as PullRequestEvent;
    const { action, pull_request: pr, repository, installation } = event;

    if (!installation?.id) {
      return NextResponse.json(
        { error: "Missing installation ID" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // 4. Look up the installation to find the org
    const { data: ghInstall } = await admin
      .from("github_installations")
      .select("org_id")
      .eq("installation_id", installation.id)
      .eq("is_active", true)
      .single();

    if (!ghInstall) {
      return NextResponse.json(
        { error: "Unknown or inactive installation" },
        { status: 404 },
      );
    }

    const orgId = ghInstall.org_id;

    // 5. Handle pull_request actions
    if (action === "opened" || action === "synchronize") {
      return handlePrOpenedOrSync(request, admin, orgId, installation.id, pr, repository, action);
    }

    if (action === "closed") {
      return handlePrClosed(request, admin, orgId, pr, repository);
    }

    // Other PR actions (e.g. labeled, assigned) are ignored
    return NextResponse.json({ message: "Action ignored" }, { status: 200 });
  } catch (error) {
    logger.error("[GitHub Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePrOpenedOrSync(
  request: Request,
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  installationId: number,
  pr: PullRequestEvent["pull_request"],
  repository: PullRequestEvent["repository"],
  action: string,
) {
  const repo = repository.full_name;
  const idempotencyKey = `github-pr-${repo}-${pr.number}-${pr.head.sha}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com";

  // For synchronize events, cancel any previous pending approval for this PR
  if (action === "synchronize") {
    const { data: existingApprovals } = await admin
      .from("approval_requests")
      .select("id")
      .eq("org_id", orgId)
      .eq("source", "github")
      .eq("status", "pending")
      .contains("metadata", { repo, pr_number: pr.number });

    if (existingApprovals && existingApprovals.length > 0) {
      const ids = existingApprovals.map((a: { id: string }) => a.id);
      await admin
        .from("approval_requests")
        .update({
          status: "cancelled",
          decision_comment: "Superseded by new commit push",
          decided_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("status", "pending");
    }
  }

  // Check idempotency -- avoid duplicate approvals for the same SHA
  const { data: existing } = await admin
    .from("approval_requests")
    .select("id")
    .eq("org_id", orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { message: "Approval already exists for this commit", approval_id: existing.id },
      { status: 200 },
    );
  }

  // Create the approval request
  const callbackUrl = `${appUrl}/api/github/callback`;
  const title = `PR #${pr.number}: ${pr.title}`;
  const description = pr.body
    ? pr.body.slice(0, 2000)
    : `Pull request from ${pr.user.login} to merge \`${pr.head.ref}\` into \`${pr.base.ref}\``;

  const metadata = {
    repo,
    pr_number: pr.number,
    pr_url: pr.html_url,
    author: pr.user.login,
    head_sha: pr.head.sha,
    head_ref: pr.head.ref,
    base_branch: pr.base.ref,
    installation_id: installationId,
  };

  const { data: approval, error: insertError } = await admin
    .from("approval_requests")
    .insert({
      org_id: orgId,
      connection_id: null,
      flow_id: null,
      source: "github",
      title,
      description,
      action_type: "merge",
      priority: "medium",
      status: "pending",
      callback_url: callbackUrl,
      callback_headers: null,
      metadata,
      context_html: null,
      expires_at: null,
      idempotency_key: idempotencyKey,
      required_approvals: 1,
      assigned_approvers: null,
      assigned_team_id: null,
      created_by: { type: "github_app", installation_id: installationId },
      required_role: null,
      is_sequential: false,
      risk_score: null,
      risk_level: null,
      risk_factors: null,
      delegated_from: null,
      delegation_id: null,
      auto_action: null,
      auto_action_after_minutes: null,
      auto_action_deadline: null,
      auto_action_warning_sent: false,
      require_rejection_reason: false,
      scheduled_execution_at: null,
      execution_status: "immediate",
      conditions: [],
      conditions_met: true,
      sla_deadline: null,
      sla_breached: false,
      sla_breached_at: null,
      sla_warning_sent: false,
      archived_at: null,
    })
    .select("id")
    .single();

  if (insertError || !approval) {
    logger.error("[GitHub Webhook] Failed to create approval:", insertError);
    return NextResponse.json(
      { error: "Failed to create approval request" },
      { status: 500 },
    );
  }

  // Create a GitHub check run in "in_progress" state
  try {
    await createCheckRun({
      installationId,
      repo,
      sha: pr.head.sha,
      status: "in_progress",
      details: {
        title: "OKrunit Approval Required",
        summary: `Waiting for human approval.\n\n**PR:** ${pr.title}\n**Author:** ${pr.user.login}`,
        details_url: `${appUrl}/dashboard?approval=${approval.id}`,
      },
    });
  } catch (checkError) {
    // Non-fatal: the approval was created even if the check run fails
    logger.error("[GitHub Webhook] Failed to create check run:", checkError);
  }

  // Audit log
  logAuditEvent({
    orgId,
    action: "approval.created",
    resourceType: "approval_request",
    resourceId: approval.id,
    details: {
      source: "github",
      pr_number: pr.number,
      repo,
      head_sha: pr.head.sha,
    },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(
    { message: "Approval created", approval_id: approval.id },
    { status: 201 },
  );
}

async function handlePrClosed(
  request: Request,
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  pr: PullRequestEvent["pull_request"],
  repository: PullRequestEvent["repository"],
) {
  const repo = repository.full_name;

  // Find and cancel any pending approvals for this PR
  const { data: pendingApprovals } = await admin
    .from("approval_requests")
    .select("id")
    .eq("org_id", orgId)
    .eq("source", "github")
    .eq("status", "pending")
    .contains("metadata", { repo, pr_number: pr.number });

  if (!pendingApprovals || pendingApprovals.length === 0) {
    return NextResponse.json(
      { message: "No pending approvals to cancel" },
      { status: 200 },
    );
  }

  const ids = pendingApprovals.map((a: { id: string }) => a.id);
  const comment = pr.merged
    ? "PR was merged (possibly bypassing approval)"
    : "PR was closed without merging";

  await admin
    .from("approval_requests")
    .update({
      status: "cancelled",
      decision_comment: comment,
      decided_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("status", "pending");

  // Audit log each cancellation
  for (const id of ids) {
    logAuditEvent({
      orgId,
      action: "approval.cancelled",
      resourceType: "approval_request",
      resourceId: id,
      details: {
        source: "github",
        reason: comment,
        pr_number: pr.number,
        repo,
      },
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json(
    { message: `Cancelled ${ids.length} pending approval(s)` },
    { status: 200 },
  );
}
