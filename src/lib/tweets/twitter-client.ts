// ---------------------------------------------------------------------------
// OKrunit -- Twitter (X) API Client
// ---------------------------------------------------------------------------
// Thin wrapper around twitter-api-v2 for posting tweets. Uses OAuth 1.0a
// user-context credentials so posts come from the founder's account.
// ---------------------------------------------------------------------------

import { TwitterApi } from "twitter-api-v2";
import { logger } from "@/lib/monitoring/logger";

export interface PostedTweet {
  id: string;
  url: string;
}

function getClient(): TwitterApi {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error(
      "Twitter API credentials missing. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET.",
    );
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret,
  });
}

interface TwitterApiError {
  code?: number;
  data?: { detail?: string; status?: number; title?: string; type?: string; errors?: unknown };
  errors?: Array<{ code?: number; message?: string }>;
  rateLimit?: { remaining?: number; reset?: number; limit?: number };
  headers?: Record<string, string>;
  message?: string;
}

function describeTwitterError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as TwitterApiError;
  const parts: string[] = [];
  if (e.code !== undefined) parts.push(`HTTP ${e.code}`);
  if (e.data?.title) parts.push(`title="${e.data.title}"`);
  if (e.data?.detail) parts.push(`detail="${e.data.detail}"`);
  if (e.data?.type) parts.push(`type="${e.data.type}"`);
  if (e.errors && Array.isArray(e.errors)) {
    for (const sub of e.errors) {
      parts.push(`error[code=${sub.code} msg="${sub.message}"]`);
    }
  }
  if (e.rateLimit) {
    parts.push(
      `rate_limit[limit=${e.rateLimit.limit} remaining=${e.rateLimit.remaining} reset=${e.rateLimit.reset ? new Date(e.rateLimit.reset * 1000).toISOString() : "?"}]`,
    );
  }
  if (e.headers) {
    const interesting = [
      "x-rate-limit-limit",
      "x-rate-limit-remaining",
      "x-rate-limit-reset",
      "x-user-limit-24hour-limit",
      "x-user-limit-24hour-remaining",
      "x-user-limit-24hour-reset",
      "x-app-limit-24hour-limit",
      "x-app-limit-24hour-remaining",
      "x-app-limit-24hour-reset",
      "x-access-level",
    ];
    const present = interesting
      .filter((k) => e.headers![k] !== undefined)
      .map((k) => `${k}=${e.headers![k]}`);
    if (present.length) parts.push(`headers[${present.join(", ")}]`);
  }
  if (parts.length === 0 && e.message) parts.push(e.message);
  return parts.join(" ");
}

async function postViaWebhook(
  content: string,
  webhookUrl: string,
): Promise<PostedTweet> {
  logger.info(
    `[Twitter] Posting via webhook (length=${content.length}, preview="${content.slice(0, 60)}...")`,
  );
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: content }),
  });
  const responseText = await resp.text();
  if (!resp.ok) {
    logger.error(
      `[Twitter] Webhook bridge failed: HTTP ${resp.status} body="${responseText.slice(0, 500)}"`,
    );
    throw new Error(`Webhook bridge HTTP ${resp.status}: ${responseText.slice(0, 200)}`);
  }
  // Try to parse a JSON response with id/url, but don't require it.
  // Make.com / Zapier / IFTTT typically return a generic OK response without
  // the actual tweet id, so we fall back to a synthetic placeholder.
  let id = "";
  let url = "";
  try {
    const parsed = JSON.parse(responseText) as { id?: string; url?: string; tweet_id?: string };
    id = parsed.id ?? parsed.tweet_id ?? "";
    url = parsed.url ?? (id ? `https://x.com/i/web/status/${id}` : "");
  } catch {
    // not JSON, fine
  }
  if (!id) {
    id = `webhook:${Date.now()}`;
  }
  logger.info(`[Twitter] Webhook accepted (id=${id})`);
  return { id, url };
}

export async function postTweet(
  content: string,
  webhookUrl?: string | null,
): Promise<PostedTweet> {
  if (webhookUrl) {
    return postViaWebhook(content, webhookUrl);
  }
  const client = getClient();
  logger.info(
    `[Twitter] Posting tweet (length=${content.length}, preview="${content.slice(0, 60)}...")`,
  );
  try {
    const result = await client.v2.tweet(content);
    if (!result?.data?.id) {
      logger.error("[Twitter] Unexpected response shape:", JSON.stringify(result));
      throw new Error("Twitter API did not return a post id");
    }
    const id = result.data.id;
    logger.info(`[Twitter] Posted tweet id=${id}`);
    return {
      id,
      url: `https://x.com/i/web/status/${id}`,
    };
  } catch (err) {
    const summary = describeTwitterError(err);
    logger.error(`[Twitter] post failed: ${summary}`);
    if (err && typeof err === "object") {
      const e = err as TwitterApiError;
      try {
        logger.error(`[Twitter] raw error: ${JSON.stringify({
          code: e.code,
          data: e.data,
          errors: e.errors,
          rateLimit: e.rateLimit,
        })}`);
      } catch {
        // ignore JSON serialization issues
      }
    }
    throw err;
  }
}

export function isTwitterConfigured(webhookUrl?: string | null): boolean {
  if (webhookUrl) return true;
  return Boolean(
    process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET,
  );
}
