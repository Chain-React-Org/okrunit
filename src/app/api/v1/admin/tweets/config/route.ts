// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Config API
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { TweetConfig } from "@/lib/tweets/types";

export async function GET() {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_config")
      .select("*")
      .eq("id", true)
      .single<TweetConfig>();
    if (error || !data) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }
    return NextResponse.json({ config: data });
  } catch (error) {
    logger.error("[AdminTweets] config GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const ALLOWED_FIELDS: Array<keyof TweetConfig> = [
  "enabled",
  "posting_slots",
  "posting_days",
  "generation_lead_minutes",
  "model",
  "fallback_model",
  "theme_feature_pct",
  "theme_lesson_pct",
  "theme_use_case_pct",
  "theme_milestone_pct",
  "notify_connection_ids",
  "auto_regenerate_on_reject",
  "post_webhook_url",
  "auto_approve_feature",
  "auto_approve_lesson",
  "auto_approve_use_case",
  "auto_approve_milestone",
];

export async function PATCH(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Partial<TweetConfig>;

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key];
    }

    if (
      typeof updates.theme_feature_pct === "number" ||
      typeof updates.theme_lesson_pct === "number" ||
      typeof updates.theme_use_case_pct === "number" ||
      typeof updates.theme_milestone_pct === "number"
    ) {
      const admin = createAdminClient();
      const { data: current } = await admin
        .from("tweet_config")
        .select("*")
        .eq("id", true)
        .single<TweetConfig>();
      if (current) {
        const f = (updates.theme_feature_pct as number | undefined) ?? current.theme_feature_pct;
        const l = (updates.theme_lesson_pct as number | undefined) ?? current.theme_lesson_pct;
        const u = (updates.theme_use_case_pct as number | undefined) ?? current.theme_use_case_pct;
        const m = (updates.theme_milestone_pct as number | undefined) ?? current.theme_milestone_pct;
        if (f + l + u + m !== 100) {
          return NextResponse.json(
            { error: "Theme percentages must sum to 100" },
            { status: 400 },
          );
        }
      }
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_config")
      .update(updates)
      .eq("id", true)
      .select()
      .single<TweetConfig>();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ config: data });
  } catch (error) {
    logger.error("[AdminTweets] config PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
