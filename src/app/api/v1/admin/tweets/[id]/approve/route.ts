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

function formatTwitterFailure(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    code?: number;
    data?: { detail?: string; title?: string };
    errors?: Array<{ code?: number; message?: string }>;
    message?: string;
  };
  const parts: string[] = [];
  if (e.code !== undefined) parts.push(`HTTP ${e.code}`);
  if (e.data?.title) parts.push(e.data.title);
  if (e.data?.detail) parts.push(e.data.detail);
  if (e.errors && Array.isArray(e.errors)) {
    for (const sub of e.errors) {
      parts.push(`(${sub.code}) ${sub.message}`);
    }
  }
  if (parts.length === 0 && e.message) parts.push(e.message);
  return parts.join(" - ") || "unknown Twitter error";
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
      const { data: config } = await admin
        .from("tweet_config")
        .select("post_webhook_url")
        .eq("id", true)
        .single<{ post_webhook_url: string | null }>();
      const webhookUrl = config?.post_webhook_url ?? null;
      if (!isTwitterConfigured(webhookUrl)) {
        return NextResponse.json(
          { error: "Configure either X API credentials or a posting webhook URL in /admin/tweets/config" },
          { status: 400 },
        );
      }
      try {
        const result = await postTweet(draft.content, webhookUrl);
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
        const failureReason = formatTwitterFailure(err);
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
