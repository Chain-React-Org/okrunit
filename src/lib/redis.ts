// ---------------------------------------------------------------------------
// OKrunit -- Redis Client (Upstash REST)
// ---------------------------------------------------------------------------
// Uses @upstash/redis which works over HTTPS. No TCP connections needed.
// Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
// Falls back gracefully if not configured.
// ---------------------------------------------------------------------------

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/** All Redis keys are automatically prefixed with this to avoid collisions when sharing a database. */
const KEY_PREFIX = "okrunit:";

export function getRedisClient(): Redis | null {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  client = new Redis({ url, token, automaticDeserialization: true });
  return client;
}

/**
 * Prefix a key with the app namespace. Use this for all Redis operations
 * to avoid collisions when sharing the database with other apps.
 */
export function prefixKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

/**
 * Check if Redis is configured (client exists).
 */
export function isRedisConfigured(): boolean {
  return getRedisClient() !== null;
}
