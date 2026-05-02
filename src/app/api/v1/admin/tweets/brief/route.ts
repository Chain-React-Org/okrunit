// ---------------------------------------------------------------------------
// OKrunit -- Admin Tweet Brief API
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import type { TweetBrief } from "@/lib/tweets/types";

export async function GET() {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_brief")
      .select("*")
      .eq("id", true)
      .single<TweetBrief>();
    if (error || !data) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }
    return NextResponse.json({ brief: data });
  } catch (error) {
    logger.error("[AdminTweets] brief GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const ALLOWED_FIELDS: Array<keyof TweetBrief> = [
  "app_description",
  "voice_guidelines",
  "shipped_features",
  "hot_takes",
  "use_cases",
  "do_not_mention",
  "example_tweets",
];

export async function PATCH(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Partial<TweetBrief>;
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body && typeof body[key] === "string") updates[key] = body[key];
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_brief")
      .update(updates)
      .eq("id", true)
      .select()
      .single<TweetBrief>();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }
    return NextResponse.json({ brief: data });
  } catch (error) {
    logger.error("[AdminTweets] brief PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
