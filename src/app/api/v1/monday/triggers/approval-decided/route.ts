// ---------------------------------------------------------------------------
// OKrunit -- monday.com Custom Trigger: Approval Decided
// ---------------------------------------------------------------------------
// POST /api/v1/monday/triggers/approval-decided
//
// Monday.com polls this endpoint on an interval. Returns recently decided
// approvals so automations can fire when someone approves or rejects.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMondayAuth } from "@/lib/api/monday-auth";

interface MondayTriggerPayload {
  payload: {
    inputFields: {
      decision_filter?: string;
      priority_filter?: string;
    };
    subscriptionId?: number;
  };
  challenge?: string;
}

export async function POST(request: Request) {
  try {
    const raw: MondayTriggerPayload = await request.json();

    if (raw.challenge) {
      return NextResponse.json({ challenge: raw.challenge });
    }

    // Verify monday.com signing secret
    if (!verifyMondayAuth(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inputFields } = raw.payload ?? {};
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

    let query = admin
      .from("approval_requests")
      .select(
        "id, title, description, status, priority, source, requested_by_name, decided_by, decided_by_name, decided_at, decision_comment, created_at, updated_at",
      )
      .eq("org_id", connection.org_id)
      .not("decided_at", "is", null)
      .order("decided_at", { ascending: false })
      .limit(50);

    if (inputFields?.decision_filter) {
      query = query.eq("status", inputFields.decision_filter);
    } else {
      query = query.in("status", ["approved", "rejected"]);
    }
    if (inputFields?.priority_filter) {
      query = query.eq("priority", inputFields.priority_filter);
    }

    const { data: approvals, error: fetchError } = await query;

    if (fetchError) {
      console.error("[monday.com Trigger] Approval decided poll failed:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch decided approvals" },
        { status: 500 },
      );
    }

    return NextResponse.json(approvals ?? []);
  } catch (error) {
    console.error("[monday.com Trigger] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
