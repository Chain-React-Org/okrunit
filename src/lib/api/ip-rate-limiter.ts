// ---------------------------------------------------------------------------
// OKrunit -- In-Memory Rate Limiter (IP / Key based)
// ---------------------------------------------------------------------------
// Sliding window counter using an in-memory Map with automatic cleanup.
// On Vercel with Fluid Compute, function instances are reused across
// concurrent requests, so the in-memory store provides effective rate
// limiting within each instance. For strict cross-instance enforcement
// at high scale, replace the store with Redis (e.g., @upstash/ratelimit).
// ---------------------------------------------------------------------------

interface WindowEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, WindowEntry>();

// Cleanup stale entries every 60 seconds
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  // Allow Node to exit even if the timer is running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

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
 * Returns whether the request is allowed and standard rate limit metadata.
 */
export function checkIpRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitCheckResult {
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key);

  // If no entry or window expired, start fresh
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: new Date(resetAt),
    };
  }

  // Window still active
  entry.count++;
  const allowed = entry.count <= config.limit;

  return {
    allowed,
    limit: config.limit,
    remaining: Math.max(0, config.limit - entry.count),
    resetAt: new Date(entry.resetAt),
  };
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
