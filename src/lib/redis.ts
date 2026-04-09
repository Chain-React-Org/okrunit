// ---------------------------------------------------------------------------
// OKrunit -- Redis Client (Upstash REST)
// ---------------------------------------------------------------------------
// Uses @upstash/redis which works over HTTPS. No TCP connections needed.
// Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
// Falls back gracefully if not configured.
// ---------------------------------------------------------------------------

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  client = new Redis({ url, token });
  return client;
}

/**
 * Check if Redis is configured (client exists).
 */
export function isRedisConfigured(): boolean {
  return getRedisClient() !== null;
}
