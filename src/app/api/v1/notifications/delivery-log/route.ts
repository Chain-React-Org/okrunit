// ---------------------------------------------------------------------------
// OKrunit -- Notification Delivery Log API: GET (paginated list)
// ---------------------------------------------------------------------------
//
// Returns notification delivery log entries for the authenticated user's org.
// Supports filtering by channel, status, and request_id.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---- GET /api/v1/notifications/delivery-log -------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate (session only, dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access the delivery log",
        "SESSION_REQUIRED",
      );
    }

    const orgId = auth.orgId;

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") || 50)));
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");
    const requestId = searchParams.get("request_id");

    // 3. Build query
    const admin = createAdminClient();
    let query = admin
      .from("notification_delivery_log")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (channel) {
      query = query.eq("channel", channel);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (requestId) {
      query = query.eq("request_id", requestId);
    }

    const { data: entries, error, count } = await query;

    if (error) {
      console.error("[DeliveryLog] Failed to fetch:", error);
      return NextResponse.json(
        { error: "Failed to fetch delivery log" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      entries: entries ?? [],
      pagination: {
        page,
        per_page: perPage,
        total: count ?? 0,
        total_pages: Math.ceil((count ?? 0) / perPage),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
