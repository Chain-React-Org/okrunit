// ---------------------------------------------------------------------------
// OKrunit -- monday.com Custom Trigger: New Approval Request
// ---------------------------------------------------------------------------
// POST /api/v1/monday/triggers/new-approval
//
// Monday.com polls this endpoint on an interval. Returns new approval requests
// since the last poll so automations can fire when approvals come in.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMondayAuth } from "@/lib/api/monday-auth";

interface MondayTriggerPayload {
  payload: {
    inputFields: {
      status_filter?: string;
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
        "id, title, description, status, priority, source, requested_by_name, created_at, updated_at",
      )
      .eq("org_id", connection.org_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (inputFields?.status_filter) {
      query = query.eq("status", inputFields.status_filter);
    }
    if (inputFields?.priority_filter) {
      query = query.eq("priority", inputFields.priority_filter);
    }

    const { data: approvals, error: fetchError } = await query;

    if (fetchError) {
      console.error("[monday.com Trigger] New approval poll failed:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch approvals" },
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
