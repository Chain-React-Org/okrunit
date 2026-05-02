// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Draft: approve
// ---------------------------------------------------------------------------
// Marks a draft as approved so the cron will post it at scheduled_for.
// If `post_now=true`, posts immediately and updates the record.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { captureError } from "@/lib/monitoring/capture";
import { postTweet, isTwitterConfigured } from "@/lib/tweets/twitter-client";
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
    const body = (await request.json().catch(() => ({}))) as { post_now?: boolean };

    const admin = createAdminClient();
    const { data: draft, error: fetchErr } = await admin
      .from("tweet_drafts")
      .select("*")
      .eq("id", id)
      .single<TweetDraft>();
    if (fetchErr || !draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.post_now) {
      if (!isTwitterConfigured()) {
        return NextResponse.json(
          { error: "Twitter API credentials not configured" },
          { status: 400 },
        );
      }
      try {
        const result = await postTweet(draft.content);
        const { data, error } = await admin
          .from("tweet_drafts")
          .update({
            status: "posted",
            approved_by: profile.id,
            approved_at: new Date().toISOString(),
            posted_at: new Date().toISOString(),
            twitter_post_id: result.id,
            twitter_post_url: result.url,
          })
          .eq("id", id)
          .select()
          .single<TweetDraft>();
        if (error || !data) {
          return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
        }
        return NextResponse.json({ draft: data });
      } catch (err) {
        captureError({ error: err, service: "TweetPoster" }).catch(() => {});
        const failureReason = err instanceof Error ? err.message : String(err);
        await admin
          .from("tweet_drafts")
          .update({ status: "failed", failure_reason: failureReason })
          .eq("id", id);
        return NextResponse.json(
          { error: `Failed to post: ${failureReason}` },
          { status: 500 },
        );
      }
    }

    const { data, error } = await admin
      .from("tweet_drafts")
      .update({
        status: "approved",
        approved_by: profile.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single<TweetDraft>();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ draft: data });
  } catch (error) {
    logger.error("[AdminTweets] approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
