// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet: manual generation
// ---------------------------------------------------------------------------
// Lets the founder generate a draft on demand for a specific scheduled time
// (or "now+15min" by default). Useful for ad-hoc posts outside the cron loop.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { captureError } from "@/lib/monitoring/capture";
import { generateTweet } from "@/lib/tweets/generator";
import { notifyDraftReady } from "@/lib/tweets/notify";
import { isThemeAutoApproved } from "@/lib/tweets/types";
import type { TweetBrief, TweetConfig, TweetDraft, TweetTheme } from "@/lib/tweets/types";

export async function POST(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      theme?: TweetTheme;
      scheduled_for?: string;
      notify?: boolean;
    };

    const admin = createAdminClient();
    const [briefRes, configRes] = await Promise.all([
      admin.from("tweet_brief").select("*").eq("id", true).single<TweetBrief>(),
      admin.from("tweet_config").select("*").eq("id", true).single<TweetConfig>(),
    ]);
    if (briefRes.error || !briefRes.data || configRes.error || !configRes.data) {
      return NextResponse.json({ error: "Brief or config missing" }, { status: 500 });
    }

    const result = await generateTweet(briefRes.data, configRes.data, body.theme);
    const autoApproved = isThemeAutoApproved(configRes.data, result.theme);
    const scheduledFor = body.scheduled_for
      ? new Date(body.scheduled_for)
      : new Date(Date.now() + 15 * 60 * 1000);

    const { data, error } = await admin
      .from("tweet_drafts")
      .insert({
        content: result.content,
        original_content: result.content,
        theme: result.theme,
        status: autoApproved ? "approved" : "pending_approval",
        approved_at: autoApproved ? new Date().toISOString() : null,
        approved_by: autoApproved ? profile.id : null,
        scheduled_for: scheduledFor.toISOString(),
        generation_metadata: { ...result.metadata, auto_approved: autoApproved },
      })
      .select()
      .single<TweetDraft>();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }

    if (body.notify !== false) {
      void notifyDraftReady(data, configRes.data.notify_connection_ids);
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    captureError({ error, service: "TweetManualGenerate" }).catch(() => {});
    logger.error("[AdminTweets] generate error:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
