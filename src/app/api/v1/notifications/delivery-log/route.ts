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
import { logger } from "@/lib/monitoring/logger";
import { titleCaseName } from "@/lib/format-name";
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

    const { data: rawEntries, error, count } = await query;

    if (error) {
      logger.error("[DeliveryLog] Failed to fetch:", error);
      return NextResponse.json(
        { error: "Failed to fetch delivery log" },
        { status: 500 },
      );
    }

    const rows = rawEntries ?? [];

    // 4. Resolve request titles and recipient names in batch
    const requestIds = [...new Set(rows.map((r: Record<string, unknown>) => r.request_id).filter(Boolean))] as string[];
    const userIds = [...new Set(rows.map((r: Record<string, unknown>) => r.recipient_user_id).filter(Boolean))] as string[];

    const [requestMap, userMap] = await Promise.all([
      requestIds.length > 0
        ? admin
            .from("approval_requests")
            .select("id, title")
            .in("id", requestIds)
            .then(({ data }) => {
              const map: Record<string, string> = {};
              for (const r of data ?? []) map[r.id] = r.title;
              return map;
            })
        : Promise.resolve({} as Record<string, string>),
      userIds.length > 0
        ? admin
            .from("user_profiles")
            .select("id, email, full_name")
            .in("id", userIds)
            .then(({ data }) => {
              const map: Record<string, string> = {};
              for (const u of data ?? []) map[u.id] = titleCaseName(u.full_name) || u.email;
              return map;
            })
        : Promise.resolve({} as Record<string, string>),
    ]);

    // 5. Build response entries
    const entries = rows.map((row: Record<string, unknown>) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const recipientUserId = row.recipient_user_id as string | null;

      // Build recipient display: profile name/email, or "to" from metadata
      let recipient = "-";
      if (recipientUserId && userMap[recipientUserId]) {
        recipient = userMap[recipientUserId];
      } else if (typeof metadata.to === "string") {
        recipient = metadata.to;
      }

      return {
        id: row.id,
        created_at: row.created_at,
        request_id: row.request_id,
        request_title: row.request_id ? (requestMap[row.request_id as string] ?? "-") : "-",
        recipient,
        channel: row.channel,
        status: row.status,
        error_message: row.error_message ?? null,
        suppression_reason: row.suppression_reason ?? null,
        external_id: row.external_id ?? null,
        metadata,
      };
    });

    return NextResponse.json({
      entries,
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
