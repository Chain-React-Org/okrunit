// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Draft: regenerate
// ---------------------------------------------------------------------------
// Generates new content for an existing draft. Optionally accepts a theme
// override; otherwise reuses the existing draft's theme.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { captureError } from "@/lib/monitoring/capture";
import { generateTweet } from "@/lib/tweets/generator";
import type { TweetBrief, TweetConfig, TweetDraft, TweetTheme } from "@/lib/tweets/types";

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
    const body = (await request.json().catch(() => ({}))) as { theme?: TweetTheme };

    const admin = createAdminClient();
    const [draftRes, briefRes, configRes] = await Promise.all([
      admin.from("tweet_drafts").select("*").eq("id", id).single<TweetDraft>(),
      admin.from("tweet_brief").select("*").eq("id", true).single<TweetBrief>(),
      admin.from("tweet_config").select("*").eq("id", true).single<TweetConfig>(),
    ]);
    if (draftRes.error || !draftRes.data) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    if (briefRes.error || !briefRes.data || configRes.error || !configRes.data) {
      return NextResponse.json({ error: "Brief or config missing" }, { status: 500 });
    }

    const themeToUse = body.theme ?? draftRes.data.theme;
    const result = await generateTweet(briefRes.data, configRes.data, themeToUse);

    const { data, error } = await admin
      .from("tweet_drafts")
      .update({
        content: result.content,
        original_content: result.content,
        theme: result.theme,
        status: "pending_approval",
        edited_by: null,
        edited_at: null,
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
        failure_reason: null,
        generation_metadata: result.metadata,
      })
      .eq("id", id)
      .select()
      .single<TweetDraft>();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ draft: data });
  } catch (error) {
    captureError({ error, service: "TweetRegenerate" }).catch(() => {});
    logger.error("[AdminTweets] regenerate error:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
