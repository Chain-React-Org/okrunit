// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Draft API: get / edit / delete one
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { TWEET_MAX_CHARS } from "@/lib/tweets/types";
import type { TweetDraft } from "@/lib/tweets/types";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_drafts")
      .select("*")
      .eq("id", id)
      .single<TweetDraft>();
    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ draft: data });
  } catch (error) {
    logger.error("[AdminTweets] GET one error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = (await request.json()) as { content?: string; scheduled_for?: string };

    const updates: Record<string, unknown> = {};
    if (typeof body.content === "string") {
      const trimmed = body.content.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
      }
      if (trimmed.length > TWEET_MAX_CHARS) {
        return NextResponse.json(
          { error: `Content exceeds ${TWEET_MAX_CHARS} characters` },
          { status: 400 },
        );
      }
      updates.content = trimmed;
      updates.edited_by = profile.id;
      updates.edited_at = new Date().toISOString();
    }
    if (typeof body.scheduled_for === "string") {
      updates.scheduled_for = body.scheduled_for;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_drafts")
      .update(updates)
      .eq("id", id)
      .select()
      .single<TweetDraft>();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ draft: data });
  } catch (error) {
    logger.error("[AdminTweets] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { error } = await admin.from("tweet_drafts").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[AdminTweets] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
