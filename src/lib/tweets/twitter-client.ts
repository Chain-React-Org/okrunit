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

export async function postTweet(content: string): Promise<PostedTweet> {
  const client = getClient();
  const result = await client.v2.tweet(content);
  if (!result?.data?.id) {
    logger.error("[Twitter] Unexpected response shape:", result);
    throw new Error("Twitter API did not return a post id");
  }
  const id = result.data.id;
  return {
    id,
    url: `https://x.com/i/web/status/${id}`,
  };
}

export function isTwitterConfigured(): boolean {
  return Boolean(
    process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET,
  );
}
