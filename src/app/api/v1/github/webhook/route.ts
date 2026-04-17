// ---------------------------------------------------------------------------
// OKrunit -- GitHub App Webhook Handler
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, createCheckRun } from "@/lib/api/github";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// POST /api/v1/github/webhook
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");

  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  const payload = JSON.parse(body);

  switch (event) {
    case "installation":
      return handleInstallation(request, payload);
    case "installation_repositories":
      return handleInstallationRepositories(payload);
    case "pull_request":
      return handlePullRequest(request, payload);
    case "check_suite":
      return handleCheckSuite(payload);
    case "ping":
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ ok: true, ignored: true });
  }
}

// ---------------------------------------------------------------------------
// Installation Events
// ---------------------------------------------------------------------------

async function handleInstallation(
  request: Request,
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const action = payload.action as string;
  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation.id as number;
  const account = installation.account as Record<string, unknown>;

  const admin = createAdminClient();

  if (action === "created") {
    // Look up the org by matching the GitHub account login to an existing
    // github_installations row OR create a placeholder to be claimed.
    const repositories = (
      (payload.repositories as Array<Record<string, unknown>>) ?? []
    ).map((r) => ({
      id: r.id,
      full_name: r.full_name,
      private: r.private,
    }));

    const { error } = await admin.from("github_installations").upsert(
      {
        installation_id: installationId,
        account_login: account.login as string,
        account_type: account.type as string,
        repositories,
        is_active: true,
      },
      { onConflict: "installation_id" },
    );

    if (error) {
      logger.error("[GitHub Webhook] Failed to upsert installation:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Audit log if we can find the org
    const { data: inst } = await admin
      .from("github_installations")
      .select("org_id")
      .eq("installation_id", installationId)
      .single();

    if (inst?.org_id) {
      logAuditEvent({
        orgId: inst.org_id,
        action: "github.installation.created",
        resourceType: "github_installation",
        details: {
          installation_id: installationId,
          account: account.login,
        },
        ipAddress: getClientIp(request),
      });
    }

    return NextResponse.json({ ok: true, action: "installed" });
  }

  if (action === "deleted" || action === "suspend") {
    const { error } = await admin
      .from("github_installations")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("installation_id", installationId);

    if (error) {
      logger.error("[GitHub Webhook] Failed to deactivate installation:", error);
    }

    return NextResponse.json({ ok: true, action: action });
  }

  if (action === "unsuspend") {
    const { error } = await admin
      .from("github_installations")
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("installation_id", installationId);

    if (error) {
      logger.error("[GitHub Webhook] Failed to reactivate installation:", error);
    }

    return NextResponse.json({ ok: true, action: "unsuspend" });
  }

  return NextResponse.json({ ok: true, ignored: true });
}

// ---------------------------------------------------------------------------
// Installation Repositories Events
// ---------------------------------------------------------------------------

async function handleInstallationRepositories(
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation.id as number;

  const admin = createAdminClient();

  // Fetch current repositories list
  const { data: existing } = await admin
    .from("github_installations")
    .select("repositories")
    .eq("installation_id", installationId)
    .single();

  if (!existing) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const repos = (existing.repositories as Array<Record<string, unknown>>) ?? [];

  const added = (
    (payload.repositories_added as Array<Record<string, unknown>>) ?? []
  ).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    private: r.private,
  }));

  const removedIds = new Set(
    (
      (payload.repositories_removed as Array<Record<string, unknown>>) ?? []
    ).map((r) => r.id),
  );

  const updated = [
    ...repos.filter((r) => !removedIds.has(r.id)),
    ...added,
  ];

  await admin
    .from("github_installations")
    .update({
      repositories: updated,
      updated_at: new Date().toISOString(),
    })
    .eq("installation_id", installationId);

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Pull Request Events
// ---------------------------------------------------------------------------

async function handlePullRequest(
  request: Request,
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const action = payload.action as string;

  // Only handle opened and synchronize (new commits pushed)
  if (action !== "opened" && action !== "synchronize") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const pr = payload.pull_request as Record<string, unknown>;
  const repo = payload.repository as Record<string, unknown>;
  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation.id as number;

  const admin = createAdminClient();

  // Find the installation and its org
  const { data: inst } = await admin
    .from("github_installations")
    .select("id, org_id")
    .eq("installation_id", installationId)
    .eq("is_active", true)
    .single();

  if (!inst?.org_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const repoFullName = repo.full_name as string;
  const prNumber = pr.number as number;
  const sha = (pr.head as Record<string, unknown>).sha as string;
  const prTitle = pr.title as string;
  const prUrl = pr.html_url as string;
  const prBody = (pr.body as string) ?? "";

  // Create a check run in "queued" state
  try {
    await createCheckRun({
      installationId,
      repo: repoFullName,
      sha,
      status: "queued",
      details: {
        title: "OKrunit Approval Required",
        summary: `Waiting for human approval for PR #${prNumber}: ${prTitle}`,
        details_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com"}/dashboard`,
      },
    });
  } catch (err) {
    logger.error("[GitHub Webhook] Failed to create check run:", err);
  }

  // Find a connection for this org to use as the API key source
  const { data: connection } = await admin
    .from("connections")
    .select("id")
    .eq("org_id", inst.org_id)
    .eq("is_active", true)
    .limit(1)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com";

  // Create an approval request
  const { data: approval, error } = await admin
    .from("approval_requests")
    .insert({
      org_id: inst.org_id,
      connection_id: connection?.id ?? null,
      title: `PR #${prNumber}: ${prTitle}`,
      description: prBody.slice(0, 5000),
      action_type: "github_pr",
      priority: "medium",
      status: "pending",
      source: "github",
      source_id: `${repoFullName}#${prNumber}`,
      metadata: {
        repo: repoFullName,
        pr_number: prNumber,
        pr_url: prUrl,
        sha,
        installation_id: installationId,
      },
      callback_url: `${appUrl}/api/v1/github/webhook`,
      idempotency_key: `github_pr_${repoFullName}_${prNumber}_${sha}`,
      created_by: {
        type: "oauth" as const,
        client_name: "GitHub",
      },
    })
    .select()
    .single();

  if (error) {
    logger.error("[GitHub Webhook] Failed to create approval:", error);
    return NextResponse.json({ error: "Failed to create approval" }, { status: 500 });
  }

  // Update check run to in_progress
  try {
    await createCheckRun({
      installationId,
      repo: repoFullName,
      sha,
      status: "in_progress",
      details: {
        title: "OKrunit Approval Pending",
        summary: `Approval request created. [Review in OKrunit](${appUrl}/dashboard)`,
        details_url: `${appUrl}/dashboard`,
      },
    });
  } catch (err) {
    logger.error("[GitHub Webhook] Failed to update check run:", err);
  }

  logAuditEvent({
    orgId: inst.org_id,
    action: "github.pr.approval_created",
    resourceType: "approval_request",
    resourceId: approval.id,
    details: {
      repo: repoFullName,
      pr_number: prNumber,
      sha,
    },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true, approval_id: approval.id });
}

// ---------------------------------------------------------------------------
// Check Suite Events
// ---------------------------------------------------------------------------

async function handleCheckSuite(
  payload: Record<string, unknown>,
): Promise<NextResponse> {
  const action = payload.action as string;

  // Only handle requested (GitHub asks us to create check runs)
  if (action !== "requested" && action !== "rerequested") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const checkSuite = payload.check_suite as Record<string, unknown>;
  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation.id as number;
  const repo = payload.repository as Record<string, unknown>;
  const sha = checkSuite.head_sha as string;

  const admin = createAdminClient();

  // Check if we have a pending approval for this SHA
  const { data: inst } = await admin
    .from("github_installations")
    .select("org_id")
    .eq("installation_id", installationId)
    .eq("is_active", true)
    .single();

  if (!inst?.org_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const repoFullName = repo.full_name as string;

  const { data: approval } = await admin
    .from("approval_requests")
    .select("id, status")
    .eq("org_id", inst.org_id)
    .eq("source", "github")
    .contains("metadata", { sha, repo: repoFullName })
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!approval) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Report current status back as a check run
  const statusMap: Record<string, { status: "queued" | "in_progress" | "completed"; conclusion?: "success" | "failure" | "cancelled" }> = {
    pending: { status: "in_progress" },
    approved: { status: "completed", conclusion: "success" },
    rejected: { status: "completed", conclusion: "failure" },
    cancelled: { status: "completed", conclusion: "cancelled" },
    expired: { status: "completed", conclusion: "cancelled" },
  };

  const check = statusMap[approval.status] ?? { status: "in_progress" };

  try {
    await createCheckRun({
      installationId,
      repo: repoFullName,
      sha,
      status: check.status,
      conclusion: check.conclusion,
      details: {
        title: `OKrunit: ${approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}`,
        summary: `Approval status: ${approval.status}`,
      },
    });
  } catch (err) {
    logger.error("[GitHub Webhook] Failed to create check run:", err);
  }

  return NextResponse.json({ ok: true });
}
