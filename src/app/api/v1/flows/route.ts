// ---------------------------------------------------------------------------
// OKrunit -- Approval Flows API: GET (list)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- GET /api/v1/flows ----------------------------------------------------

export async function GET(request: Request) {
  try {
    // Session auth only -- dashboard users manage flows
    const auth = await authenticateRequest(request);

    if (auth.type === "api_key") {
      throw new ApiError(403, "Session or OAuth auth required", "SESSION_REQUIRED");
    }

    const admin = createAdminClient();

    const { data: flows, error } = await admin
      .from("approval_flows")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("last_request_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("[Flows] Query failed:", error);
      throw new ApiError(500, "Failed to fetch approval flows");
    }

    return NextResponse.json({ data: flows ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
