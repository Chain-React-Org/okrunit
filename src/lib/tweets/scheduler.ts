// ---------------------------------------------------------------------------
// OKrunit -- Tweet Scheduler
// ---------------------------------------------------------------------------
// Computes upcoming posting slots, ensures drafts are generated ahead of
// time, and posts approved drafts when their scheduled time arrives.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { captureError } from "@/lib/monitoring/capture";
import { generateTweet } from "@/lib/tweets/generator";
import { notifyDraftReady } from "@/lib/tweets/notify";
import { postTweet, isTwitterConfigured } from "@/lib/tweets/twitter-client";
import type { TweetBrief, TweetConfig, TweetDraft } from "@/lib/tweets/types";

const SLOT_MATCH_WINDOW_MS = 60 * 1000;

interface SchedulerRunResult {
  generated: number;
  posted: number;
  errors: number;
}

async function loadConfig(): Promise<{
  brief: TweetBrief;
  config: TweetConfig;
} | null> {
  const admin = createAdminClient();
  const [briefRes, configRes] = await Promise.all([
    admin.from("tweet_brief").select("*").eq("id", true).single<TweetBrief>(),
    admin.from("tweet_config").select("*").eq("id", true).single<TweetConfig>(),
  ]);
  if (briefRes.error || !briefRes.data) {
    logger.error("[Tweets] Brief not found:", briefRes.error);
    return null;
  }
  if (configRes.error || !configRes.data) {
    logger.error("[Tweets] Config not found:", configRes.error);
    return null;
  }
  return { brief: briefRes.data, config: configRes.data };
}

/**
 * Compute the next N slot timestamps after the given reference time.
 * Slots are HH:mm in UTC. Days are 0-6 (Sun-Sat).
 */
export function nextSlots(
  config: TweetConfig,
  from: Date,
  count: number,
): Date[] {
  if (config.posting_slots.length === 0) return [];
  const result: Date[] = [];
  let cursor = new Date(from);
  let safety = 0;
  while (result.length < count && safety < 30) {
    const day = cursor.getUTCDay();
    if (config.posting_days.includes(day)) {
      for (const slot of config.posting_slots) {
        const [h, m] = slot.split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) continue;
        const ts = new Date(
          Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth(),
            cursor.getUTCDate(),
            h,
            m,
            0,
            0,
          ),
        );
        if (ts.getTime() > from.getTime() && result.length < count) {
          result.push(ts);
        }
      }
    }
    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );
    safety++;
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

async function findExistingDraftForSlot(
  scheduledFor: Date,
): Promise<TweetDraft | null> {
  const admin = createAdminClient();
  const lower = new Date(scheduledFor.getTime() - SLOT_MATCH_WINDOW_MS).toISOString();
  const upper = new Date(scheduledFor.getTime() + SLOT_MATCH_WINDOW_MS).toISOString();
  const { data, error } = await admin
    .from("tweet_drafts")
    .select("*")
    .gte("scheduled_for", lower)
    .lte("scheduled_for", upper)
    .in("status", ["pending_approval", "approved", "posted"])
    .limit(1)
    .returns<TweetDraft[]>();
  if (error) {
    logger.error("[Tweets] Slot lookup error:", error);
    return null;
  }
  return data?.[0] ?? null;
}

async function generateAndStoreDraft(
  brief: TweetBrief,
  config: TweetConfig,
  scheduledFor: Date,
): Promise<TweetDraft | null> {
  try {
    const result = await generateTweet(brief, config);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tweet_drafts")
      .insert({
        content: result.content,
        original_content: result.content,
        theme: result.theme,
        status: "pending_approval",
        scheduled_for: scheduledFor.toISOString(),
        generation_metadata: result.metadata,
      })
      .select()
      .single<TweetDraft>();
    if (error || !data) {
      logger.error("[Tweets] Failed to insert draft:", error);
      return null;
    }
    return data;
  } catch (err) {
    captureError({ error: err, service: "TweetGenerator" }).catch(() => {});
    return null;
  }
}

async function ensureUpcomingDrafts(
  brief: TweetBrief,
  config: TweetConfig,
  now: Date,
): Promise<number> {
  const horizonMs = config.generation_lead_minutes * 60 * 1000;
  const horizon = new Date(now.getTime() + horizonMs);
  const slots = nextSlots(config, now, 4).filter(
    (slot) => slot.getTime() <= horizon.getTime(),
  );

  let generated = 0;
  for (const slot of slots) {
    const existing = await findExistingDraftForSlot(slot);
    if (existing) continue;
    const draft = await generateAndStoreDraft(brief, config, slot);
    if (draft) {
      generated++;
      await notifyDraftReady(draft, config.notify_connection_ids);
    }
  }
  return generated;
}

async function postApprovedDrafts(now: Date): Promise<{
  posted: number;
  errors: number;
}> {
  if (!isTwitterConfigured()) return { posted: 0, errors: 0 };

  const admin = createAdminClient();
  const { data: due, error } = await admin
    .from("tweet_drafts")
    .select("*")
    .eq("status", "approved")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(5)
    .returns<TweetDraft[]>();

  if (error) {
    logger.error("[Tweets] Failed to load due drafts:", error);
    return { posted: 0, errors: 1 };
  }

  let posted = 0;
  let errors = 0;
  for (const draft of due ?? []) {
    try {
      const result = await postTweet(draft.content);
      await admin
        .from("tweet_drafts")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          twitter_post_id: result.id,
          twitter_post_url: result.url,
        })
        .eq("id", draft.id);
      posted++;
    } catch (err) {
      errors++;
      const failureReason = err instanceof Error ? err.message : String(err);
      await admin
        .from("tweet_drafts")
        .update({
          status: "failed",
          failure_reason: failureReason,
        })
        .eq("id", draft.id);
      captureError({ error: err, service: "TweetPoster" }).catch(() => {});
    }
  }
  return { posted, errors };
}

async function expireStaleDrafts(now: Date): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("tweet_drafts")
    .update({ status: "expired" })
    .eq("status", "pending_approval")
    .lt("scheduled_for", new Date(now.getTime() - 5 * 60 * 1000).toISOString());
}

export async function runScheduler(): Promise<SchedulerRunResult> {
  const loaded = await loadConfig();
  if (!loaded) {
    return { generated: 0, posted: 0, errors: 1 };
  }
  const { brief, config } = loaded;
  if (!config.enabled) {
    return { generated: 0, posted: 0, errors: 0 };
  }

  const now = new Date();
  await expireStaleDrafts(now);
  const generated = await ensureUpcomingDrafts(brief, config, now);
  const { posted, errors } = await postApprovedDrafts(now);
  return { generated, posted, errors };
}
