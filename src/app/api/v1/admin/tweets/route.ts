// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Drafts API: list
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { TweetDraft } from "@/lib/tweets/types";

export async function GET(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
    const offset = Number(searchParams.get("offset") ?? 0);

    const admin = createAdminClient();
    let query = admin
      .from("tweet_drafts")
      .select("*", { count: "exact" });

    if (status) query = query.eq("status", status);

    query = query
      .order("scheduled_for", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query.returns<TweetDraft[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const [
      { count: pendingCount },
      { count: approvedCount },
      { count: postedCount },
    ] = await Promise.all([
      admin
        .from("tweet_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_approval"),
      admin
        .from("tweet_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),
      admin
        .from("tweet_drafts")
        .select("*", { count: "exact", head: true })
        .eq("status", "posted"),
    ]);

    return NextResponse.json({
      drafts: data ?? [],
      total: count ?? 0,
      stats: {
        pending: pendingCount ?? 0,
        approved: approvedCount ?? 0,
        posted: postedCount ?? 0,
      },
    });
  } catch (error) {
    logger.error("[AdminTweets] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
