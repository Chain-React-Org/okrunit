// ---------------------------------------------------------------------------
// OKrunit -- Cron: Data Retention Cleanup
// ---------------------------------------------------------------------------
// Runs daily. Deletes old records to prevent unbounded table growth.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/monitoring/capture";
import { verifyCronAuth } from "@/lib/api/cron-auth";

export async function POST(request: Request) {
  return handleRetention(request);
}

async function handleRetention(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const cleaned: string[] = [];

  try {
    // 1. Webhook delivery logs older than 90 days
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("webhook_delivery_log")
      .delete()
      .lt("created_at", ninetyDaysAgo);
    cleaned.push("webhook_delivery_log (>90 days)");

    // 2. Error events older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("error_events")
      .delete()
      .lt("created_at", thirtyDaysAgo);
    cleaned.push("error_events (>30 days)");

    // 3. Expired/used OAuth authorization codes older than 1 day
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("oauth_authorization_codes")
      .delete()
      .lt("expires_at", oneDayAgo);
    cleaned.push("oauth_authorization_codes (expired)");

    // 4. Read in-app notifications older than 30 days
    await admin
      .from("in_app_notifications")
      .delete()
      .eq("is_read", true)
      .lt("created_at", thirtyDaysAgo);
    cleaned.push("in_app_notifications (read, >30 days)");

    return NextResponse.json({ cleaned, count: cleaned.length });
  } catch (error) {
    captureError({ error, service: "DataRetention" }).catch(() => {});
    return NextResponse.json({ error: "Retention job failed" }, { status: 500 });
  }
}
