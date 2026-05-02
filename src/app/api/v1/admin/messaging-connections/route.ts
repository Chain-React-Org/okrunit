// ---------------------------------------------------------------------------
// OKrunit -- Admin: list messaging connections (for tweet automation config)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

export async function GET() {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("messaging_connections")
      .select("id, platform, channel_name, workspace_name, is_active")
      .eq("is_active", true)
      .order("platform");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ connections: data ?? [] });
  } catch (error) {
    logger.error("[AdminMessagingConnections] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
