// ---------------------------------------------------------------------------
// OKrunit -- Webhooks API: GET (delivery log viewer)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { webhookLogQuerySchema } from "@/lib/api/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ---- GET /api/v1/webhooks -------------------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session only (dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access webhook logs",
        "SESSION_REQUIRED",
      );
    }

    const orgId = auth.orgId;

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const queryInput = {
      request_id: searchParams.get("request_id") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    };

    const params = webhookLogQuerySchema.parse(queryInput);
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    const admin = createAdminClient();

    // 3. Build query -- join through approval_requests to scope by org_id
    //    webhook_delivery_log has connection_id; connections belong to an org.
    //    We filter by joining through approval_requests which have org_id.
    let query = admin
      .from("webhook_delivery_log")
      .select(
        `
        id,
        request_id,
        connection_id,
        url,
        method,
        request_headers,
        request_body,
        response_status,
        response_headers,
        response_body,
        duration_ms,
        attempt_number,
        success,
        error_message,
        created_at
      `,
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Scope to org via connection_id
    // First get all connection IDs belonging to this org
    const { data: connections } = await admin
      .from("connections")
      .select("id")
      .eq("org_id", orgId);

    const connectionIds = (connections ?? []).map((c) => c.id);

    if (connectionIds.length === 0) {
      // No connections means no webhook logs
      return NextResponse.json({
        data: [],
        total: 0,
        limit,
        offset,
      });
    }

    query = query.in("connection_id", connectionIds);

    // 4. Apply filters
    if (params.request_id) {
      query = query.eq("request_id", params.request_id);
    }

    if (params.status === "success") {
      query = query.eq("success", true);
    } else if (params.status === "failed") {
      query = query.eq("success", false);
    }

    const { data: logs, error: queryError } = await query;

    if (queryError) {
      console.error("[Webhooks] Query failed:", queryError);
      throw new ApiError(500, "Failed to fetch webhook delivery logs");
    }

    // 5. Count query
    let countQuery = admin
      .from("webhook_delivery_log")
      .select("*", { count: "exact", head: true })
      .in("connection_id", connectionIds);

    if (params.request_id) {
      countQuery = countQuery.eq("request_id", params.request_id);
    }

    if (params.status === "success") {
      countQuery = countQuery.eq("success", true);
    } else if (params.status === "failed") {
      countQuery = countQuery.eq("success", false);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      data: logs ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
