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

    const { inputFields } = raw.payload ?? {};

    if (!inputFields?.approval_id) {
      return NextResponse.json(
        { error: "approval_id is required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: approval, error: fetchError } = await admin
      .from("approval_requests")
      .select(
        "id, title, description, status, priority, source, callback_url, source_url, metadata, requested_by_name, decided_by, decided_by_name, decided_at, decision_comment, created_at, updated_at",
      )
      .eq("id", inputFields.approval_id)
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
