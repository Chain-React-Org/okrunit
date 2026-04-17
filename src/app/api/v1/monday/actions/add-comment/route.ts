// ---------------------------------------------------------------------------
// OKrunit -- monday.com Integration Action: Add Comment
// ---------------------------------------------------------------------------
// POST /api/v1/monday/actions/add-comment
//
// Called by monday.com when an automation block adds a comment to an approval.
// monday.com sends: payload.inputFields { approval_id, body }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { verifyMondayAuth } from "@/lib/api/monday-auth";
import { logger } from "@/lib/monitoring/logger";

interface MondayActionPayload {
  payload: {
    inputFields: {
      approval_id?: string;
      body?: string;
    };
    subscriptionId?: number;
  };
  challenge?: string;
}

export async function POST(request: Request) {
  try {
    const raw: MondayActionPayload = await request.json();

    if (raw.challenge) {
      return NextResponse.json({ challenge: raw.challenge });
    }

    // Verify monday.com signing secret
    if (!verifyMondayAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inputFields } = raw.payload ?? {};

    if (!inputFields?.approval_id || !inputFields?.body) {
      return NextResponse.json(
        { error: "approval_id and body are required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Scope to the org's monday.com connection
    const { data: connection } = await admin
      .from("messaging_connections")
      .select("org_id")
      .eq("platform", "monday")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json({ error: "No active monday.com connection" }, { status: 404 });
    }

    // Verify the approval exists and belongs to this org
    const { data: approval, error: fetchError } = await admin
      .from("approval_requests")
      .select("id, org_id")
      .eq("id", inputFields.approval_id)
      .eq("org_id", connection.org_id)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 },
      );
    }

    const { data: comment, error: insertError } = await admin
      .from("approval_comments")
      .insert({
        request_id: approval.id,
        body: inputFields.body.slice(0, 5000),
        source: "monday",
      })
      .select()
      .single();

    if (insertError) {
      logger.error("[monday.com Action] Add comment failed:", insertError);
      return NextResponse.json(
        { error: "Failed to add comment" },
        { status: 500 },
      );
    }

    logAuditEvent({
      orgId: approval.org_id,
      action: "approval_comment.created",
      resourceType: "approval_comment",
      resourceId: comment.id,
      ipAddress: getClientIp(request),
      details: {
        source: "monday",
        approval_id: approval.id,
      },
    });

    return NextResponse.json({
      id: comment.id,
      approval_id: approval.id,
      body: comment.body,
      created_at: comment.created_at,
    });
  } catch (error) {
    logger.error("[monday.com Action] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
