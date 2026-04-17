// ---------------------------------------------------------------------------
// OKrunit -- Rate Limiter (IP / Key based)
// ---------------------------------------------------------------------------
// Uses Upstash Redis for distributed rate limiting when configured. Falls
// back to an in-memory Map when Redis is not available (dev/single-instance).
// ---------------------------------------------------------------------------

import { getRedisClient, prefixKey } from "@/lib/redis";
import { logger } from "@/lib/monitoring/logger";

// ---- In-memory fallback ---------------------------------------------------

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms
}

const memoryStore = new Map<string, WindowEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) memoryStore.delete(key);
    }
  }, 60_000);
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitCheckResult {
  ensureCleanup();

  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: new Date(resetAt),
    };
  }

  entry.count++;
  const allowed = entry.count <= config.limit;

  return {
    allowed,
    limit: config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetAt: new Date(entry.resetAt),
  };
}

// ---- Redis-backed implementation ------------------------------------------

async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitCheckResult> {
  const redis = getRedisClient();
  if (!redis) return checkMemoryRateLimit(key, config);

  const redisKey = prefixKey(`rl:${key}`);
  const windowSeconds = config.windowSeconds;

  try {
    // Atomic: increment the counter and set expiry if new
    const count = await redis.incr(redisKey);

    if (count === 1) {
      // First request in this window, set TTL
      await redis.expire(redisKey, windowSeconds);
    }

    // Get TTL to calculate resetAt
    const ttl = await redis.ttl(redisKey);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000));

    const allowed = count <= config.limit;

    return {
      allowed,
      limit: config.limit,
      remaining: Math.max(0, config.limit - count),
      resetAt,
    };
  } catch (err) {
    logger.warn("[RateLimit] Redis error, falling back to memory:", (err as Error).message);
    return checkMemoryRateLimit(key, config);
  }
}

// ---- Public API -----------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum number of requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Check rate limit for a given key (IP, user ID, org ID, etc.).
 * Synchronous version using in-memory store. Use checkIpRateLimitAsync
 * for distributed enforcement via Redis.
 */
export function checkIpRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitCheckResult {
  return checkMemoryRateLimit(key, config);
}

/**
 * Async rate limit check that uses Redis when available.
 * Falls back to in-memory if Redis is not configured or errors.
 */
export async function checkIpRateLimitAsync(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitCheckResult> {
  const redis = getRedisClient();
  if (redis) {
    return checkRedisRateLimit(key, config);
  }
  return checkMemoryRateLimit(key, config);
}

/**
 * Get the client IP from a request, checking common proxy headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- Preset configurations ------------------------------------------------

/** General API routes: 100 requests per minute per IP */
export const API_RATE_LIMIT: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
};

/** Auth-related routes: 10 requests per minute per IP */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowSeconds: 60,
};

/** Sensitive write operations: 20 requests per minute per key */
export const WRITE_RATE_LIMIT: RateLimitConfig = {
  limit: 20,
  windowSeconds: 60,
};

/** Invite emails: 10 per hour per org */
export const INVITE_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowSeconds: 3600,
};

/** Webhook replay: 5 per minute per user */
export const REPLAY_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowSeconds: 60,
};

/** Export/analytics: 10 per minute per user */
export const ANALYTICS_RATE_LIMIT: RateLimitConfig = {
  limit: 10,
  windowSeconds: 60,
};

/**
 * Helper: return a 429 response with rate limit headers.
 */
export function rateLimitResponse(result: RateLimitCheckResult): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.floor(result.resetAt.getTime() / 1000)),
        "Retry-After": String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)),
      },
    },
  );
}
