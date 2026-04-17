// ---------------------------------------------------------------------------
// OKrunit -- In-App Notifications Feed
// ---------------------------------------------------------------------------
// Returns the user's in-app notifications, paginated and ordered by recency.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") || 20), 50);
  const unreadOnly = searchParams.get("unread") === "true";

  const admin = createAdminClient();

  let query = admin
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const [{ data: notifications, error }, { count: unreadCount }] = await Promise.all([
    query,
    admin
      .from("in_app_notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  if (error) {
    logger.error("[Notifications] Failed to fetch:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  return NextResponse.json({
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
