// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Draft: reject
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { TweetDraft } from "@/lib/tweets/types";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_drafts")
      .update({
        status: "rejected",
        rejection_reason: body.reason ?? null,
      })
      .eq("id", id)
      .select()
      .single<TweetDraft>();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ draft: data });
  } catch (error) {
    logger.error("[AdminTweets] reject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
