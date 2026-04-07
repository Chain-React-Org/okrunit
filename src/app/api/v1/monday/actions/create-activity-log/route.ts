// ---------------------------------------------------------------------------
// OKrunit -- monday.com Integration Action: Create Activity Log
// ---------------------------------------------------------------------------
// POST /api/v1/monday/actions/create-activity-log
//
// Logs an activity in OKRunit for audit/tracking. Does NOT create an approval
// request. The automation continues immediately.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";

interface MondayActionPayload {
  payload: {
    inputFields: {
      title?: string;
      description?: string;
      source_url?: string;
      metadata?: string;
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

    const { inputFields } = raw.payload ?? {};

    if (!inputFields?.title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Find the org with an active monday.com connection
    const { data: connection } = await admin
      .from("messaging_connections")
      .select("org_id")
      .eq("platform", "monday")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "No active monday.com connection found." },
        { status: 404 },
      );
    }

    let metadata: Record<string, unknown> | undefined;
    if (inputFields.metadata) {
      try {
        metadata = JSON.parse(inputFields.metadata);
      } catch {
        return NextResponse.json(
          { error: "Metadata must be valid JSON" },
          { status: 400 },
        );
      }
    }

    const idempotencyKey = `monday-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const { data: log, error: insertError } = await admin
      .from("approval_requests")
      .insert({
        org_id: connection.org_id,
        title: inputFields.title.slice(0, 500),
        description: inputFields.description?.slice(0, 5000) || null,
        source: "monday",
        source_url: inputFields.source_url || null,
        priority: "medium",
        status: "pending",
        is_log: true,
        metadata: metadata ?? null,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[monday.com Action] Create activity log failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create activity log" },
        { status: 500 },
      );
    }

    logAuditEvent({
      orgId: connection.org_id,
      action: "approval_request.created",
      resourceType: "approval_request",
      resourceId: log.id,
      ipAddress: getClientIp(request),
      details: {
        source: "monday",
        is_log: true,
        title: inputFields.title,
      },
    });

    return NextResponse.json({
      id: log.id,
      title: log.title,
      description: log.description,
      status: log.status,
      priority: log.priority,
      source: "monday",
      created_at: log.created_at,
    });
  } catch (error) {
    console.error("[monday.com Action] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
