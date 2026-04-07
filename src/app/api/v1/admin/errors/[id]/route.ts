// ---------------------------------------------------------------------------
// OKrunit -- Admin Error Issue Detail API: GET, PATCH
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErrorIssue, ErrorEvent, ErrorIssueStatus } from "@/lib/monitoring/types";

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

    return NextResponse.json({ issue, events: events ?? [] });
  } catch (error) {
    console.error("[AdminErrors] GET detail error:", error);
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
    console.error("[AdminErrors] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
