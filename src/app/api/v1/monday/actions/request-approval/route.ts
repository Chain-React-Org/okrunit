// ---------------------------------------------------------------------------
// OKrunit -- monday.com Integration Action: Request Approval
// ---------------------------------------------------------------------------
// POST /api/v1/monday/actions/request-approval
//
// Called by monday.com when a workflow recipe triggers. Receives the input
// fields configured in the Workflow Block and creates an approval request.
//
// monday.com sends a JSON payload with:
//   - payload.inputFields: the user-configured fields
//   - payload.webhookUrl: URL to call back when the action completes
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
      boardId?: string;
      itemId?: string;
      userId?: string;
      userName?: string;
      boardName?: string;
    };
    webhookUrl?: string;
    subscriptionId?: number;
    inboundFieldValues?: Record<string, unknown>;
  };
  challenge?: string;
}

export async function POST(request: Request) {
  try {
    const body: MondayActionPayload = await request.json();

    // Handle monday.com webhook challenge (verification handshake)
    if (body.challenge) {
      return NextResponse.json({ challenge: body.challenge });
    }

    const { inputFields, webhookUrl } = body.payload ?? {};

    if (!inputFields) {
      return NextResponse.json(
        { error: "Missing inputFields in payload" },
        { status: 400 },
      );
    }

    const title =
      inputFields.title ||
      (inputFields.boardName && inputFields.itemId
        ? `Approval for item #${inputFields.itemId} on ${inputFields.boardName}`
        : "Approval request from monday.com");

    const description = [
      inputFields.description,
      inputFields.boardName && `Board: ${inputFields.boardName}`,
      inputFields.itemId && `Item ID: ${inputFields.itemId}`,
      inputFields.userName && `Triggered by: ${inputFields.userName}`,
    ]
      .filter(Boolean)
      .join("\n");

    const metadata: Record<string, unknown> = {};
    if (inputFields.boardId) metadata.board_id = inputFields.boardId;
    if (inputFields.itemId) metadata.item_id = inputFields.itemId;
    if (inputFields.userId) metadata.monday_user_id = inputFields.userId;
    if (inputFields.userName) metadata.monday_user_name = inputFields.userName;
    if (inputFields.boardName) metadata.board_name = inputFields.boardName;

    // Create the approval request via internal API
    const admin = createAdminClient();

    // Find the org that has a monday.com connection
    const { data: connection } = await admin
      .from("messaging_connections")
      .select("org_id")
      .eq("platform", "monday")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "No active monday.com connection found. Please install the OKrunit app in your monday.com account first." },
        { status: 404 },
      );
    }

    const orgId = connection.org_id;

    const idempotencyKey = `monday-${inputFields.boardId ?? "board"}-${inputFields.itemId ?? "item"}-${Date.now()}`;

    const { data: approval, error: insertError } = await admin
      .from("approval_requests")
      .insert({
        org_id: orgId,
        title,
        description: description || null,
        source: "monday",
        priority: "medium",
        status: "pending",
        callback_url: webhookUrl || null,
        metadata,
        idempotency_key: idempotencyKey,
        requested_by_name: inputFields.userName || null,
        created_by: {
          type: "integration",
          platform: "monday",
          monday_user_id: inputFields.userId,
          monday_user_name: inputFields.userName,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[monday.com Action] Insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create approval request" },
        { status: 500 },
      );
    }

    logAuditEvent({
      orgId,
      action: "approval_request.created",
      resourceType: "approval_request",
      resourceId: approval.id,
      ipAddress: getClientIp(request),
      details: {
        source: "monday",
        title,
        board_id: inputFields.boardId,
        item_id: inputFields.itemId,
      },
    });

    return NextResponse.json({
      id: approval.id,
      title: approval.title,
      status: approval.status,
      priority: approval.priority,
      source: "monday",
      created_at: approval.created_at,
    });
  } catch (error) {
    console.error("[monday.com Action] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
