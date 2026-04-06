// ---------------------------------------------------------------------------
// OKrunit -- monday.com Integration Action: List Approvals
// ---------------------------------------------------------------------------
// POST /api/v1/monday/actions/list-approvals
//
// Called by monday.com automation blocks. Returns a filtered list of approval
// requests so users can reference approval data in their automations.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface MondayActionPayload {
  payload: {
    inputFields: {
      status?: string;
      priority?: string;
      search?: string;
      limit?: string;
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
        "id, title, description, status, priority, source, requested_by_name, decided_by_name, decided_at, decision_comment, created_at, updated_at",
      )
      .eq("org_id", connection.org_id)
      .order("created_at", { ascending: false });

    if (inputFields?.status) {
      query = query.eq("status", inputFields.status);
    }
    if (inputFields?.priority) {
      query = query.eq("priority", inputFields.priority);
    }
    if (inputFields?.search) {
      query = query.or(
        `title.ilike.%${inputFields.search}%,description.ilike.%${inputFields.search}%`,
      );
    }

    const limit = Math.min(
      Math.max(parseInt(inputFields?.limit ?? "25", 10) || 25, 1),
      100,
    );
    query = query.limit(limit);

    const { data: approvals, error: fetchError } = await query;

    if (fetchError) {
      console.error("[monday.com Action] List approvals failed:", fetchError);
      return NextResponse.json(
        { error: "Failed to list approvals" },
        { status: 500 },
      );
    }

    return NextResponse.json(approvals ?? []);
  } catch (error) {
    console.error("[monday.com Action] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
