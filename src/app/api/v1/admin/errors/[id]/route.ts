// ---------------------------------------------------------------------------
// OKrunit -- Admin Error Issue Detail API: GET, PATCH
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErrorIssue, ErrorEvent, ErrorIssueStatus } from "@/lib/monitoring/types";
import { logger } from "@/lib/monitoring/logger";

// ---- GET /api/v1/admin/errors/[id] ----------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const admin = createAdminClient();

    const [{ data: issue }, { data: events }] = await Promise.all([
      admin
        .from("error_issues")
        .select("*")
        .eq("id", id)
        .single()
        .returns<ErrorIssue>(),
      admin
        .from("error_events")
        .select("*")
        .eq("issue_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<ErrorEvent[]>(),
    ]);

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // Build a single string that can be copied into Claude for debugging.
    // Includes the most recent event's details combined with the issue summary.
    const latestEvent = (events ?? [])[0] as ErrorEvent | undefined;
    const aiDebugContext = buildAiDebugContext(issue as ErrorIssue, latestEvent);

    return NextResponse.json({
      issue,
      events: events ?? [],
      ai_debug_context: aiDebugContext,
    });
  } catch (error) {
    logger.error("[AdminErrors] GET detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---- PATCH /api/v1/admin/errors/[id] - Update status ----------------------

const VALID_STATUSES: ErrorIssueStatus[] = ["unresolved", "resolved", "ignored"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status?: string };

    if (!status || !VALID_STATUSES.includes(status as ErrorIssueStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const updateData: Record<string, unknown> = { status };

    if (status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = profile.id;
      // Record the current release so regression detection works
      updateData.resolved_in_release =
        process.env.VERCEL_GIT_COMMIT_SHA ??
        process.env.NEXT_PUBLIC_GIT_SHA ??
        null;
    } else if (status === "unresolved") {
      // Reopening - clear resolution fields
      updateData.resolved_at = null;
      updateData.resolved_by = null;
      updateData.resolved_in_release = null;
    }

    const { data, error } = await admin
      .from("error_issues")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ issue: data });
  } catch (error) {
    logger.error("[AdminErrors] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// AI Debug Context Builder
// ---------------------------------------------------------------------------
// Produces a single copyable string with all relevant error details for
// pasting into an AI assistant (Claude, etc.) to aid debugging.
// ---------------------------------------------------------------------------

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "x-api-key",
  "x-secret",
]);

function buildAiDebugContext(
  issue: ErrorIssue,
  latestEvent?: ErrorEvent,
): string {
  const sections: string[] = [];

  sections.push("## Error Summary");
  sections.push(`Title: ${issue.title}`);
  sections.push(`Severity: ${issue.severity}`);
  sections.push(`Status: ${issue.status}`);
  sections.push(`Service: ${issue.service ?? "unknown"}`);
  sections.push(`First seen: ${issue.first_seen_at}`);
  sections.push(`Last seen: ${issue.last_seen_at}`);
  sections.push(`Occurrences: ${issue.event_count}`);
  sections.push(`Affected users: ${issue.affected_users}`);

  if (latestEvent) {
    sections.push("");
    sections.push("## Latest Event");
    sections.push(`Error type: ${latestEvent.error_type}`);
    sections.push(`Message: ${latestEvent.message}`);
    sections.push(`Environment: ${latestEvent.environment}`);
    sections.push(`Release: ${latestEvent.release ?? "unknown"}`);
    sections.push(`Timestamp: ${latestEvent.created_at}`);

    if (latestEvent.correlation_id) {
      sections.push(`Correlation ID: ${latestEvent.correlation_id}`);
    }

    if (latestEvent.request_url || latestEvent.request_method) {
      sections.push("");
      sections.push("## Request");
      if (latestEvent.request_method) {
        sections.push(`Method: ${latestEvent.request_method}`);
      }
      if (latestEvent.request_url) {
        sections.push(`URL: ${latestEvent.request_url}`);
      }
    }

    // Include context but strip sensitive headers
    if (latestEvent.context && Object.keys(latestEvent.context).length > 0) {
      const safeContext = { ...latestEvent.context };
      if (
        safeContext.headers &&
        typeof safeContext.headers === "object"
      ) {
        const safeHeaders: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(
          safeContext.headers as Record<string, unknown>,
        )) {
          if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
            safeHeaders[key] = val;
          }
        }
        safeContext.headers = safeHeaders;
      }
      sections.push("");
      sections.push("## Context");
      sections.push(JSON.stringify(safeContext, null, 2));
    }

    if (latestEvent.stack_trace) {
      sections.push("");
      sections.push("## Stack Trace");
      sections.push(latestEvent.stack_trace);
    }

    if (latestEvent.breadcrumbs && latestEvent.breadcrumbs.length > 0) {
      sections.push("");
      sections.push("## Breadcrumbs (most recent last)");
      for (const crumb of latestEvent.breadcrumbs) {
        const dataStr = crumb.data
          ? ` ${JSON.stringify(crumb.data)}`
          : "";
        sections.push(
          `[${crumb.timestamp}] [${crumb.type}/${crumb.category}] ${crumb.message}${dataStr}`,
        );
      }
    }
  }

  if (issue.tags && Object.keys(issue.tags).length > 0) {
    sections.push("");
    sections.push("## Tags");
    for (const [key, val] of Object.entries(issue.tags)) {
      sections.push(`${key}: ${val}`);
    }
  }

  return sections.join("\n");
}
