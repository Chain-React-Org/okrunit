// ---------------------------------------------------------------------------
// OKrunit -- monday.com Integration Action: Get Approval
// ---------------------------------------------------------------------------
// POST /api/v1/monday/actions/get-approval
//
// Called by monday.com when an automation block fetches an approval by ID.
// monday.com sends: payload.inputFields { approval_id }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { verifyMondayAuth } from "@/lib/api/monday-auth";

interface MondayActionPayload {
  payload: {
    inputFields: {
      approval_id?: string;
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

    if (!inputFields?.approval_id) {
      return NextResponse.json(
        { error: "approval_id is required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Scope to the org's monday.com connection to prevent cross-org access
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

    const { data: approval, error: fetchError } = await admin
      .from("approval_requests")
      .select(
        "id, title, description, status, priority, source, callback_url, source_url, metadata, requested_by_name, decided_by, decided_by_name, decided_at, decision_comment, created_at, updated_at",
      )
      .eq("id", inputFields.approval_id)
      .eq("org_id", connection.org_id)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error("[monday.com Action] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
