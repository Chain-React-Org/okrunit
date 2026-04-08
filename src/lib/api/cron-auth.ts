// ---------------------------------------------------------------------------
// OKrunit -- Shared Cron Authentication
// ---------------------------------------------------------------------------
// Verifies that incoming cron requests carry the correct CRON_SECRET,
// using timing-safe comparison to prevent timing attacks.
// ---------------------------------------------------------------------------

import { timingSafeEqual } from "crypto";

export function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const xCronSecret = request.headers.get("x-cron-secret");
  if (xCronSecret && safeEqual(xCronSecret, secret)) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader && safeEqual(authHeader, `Bearer ${secret}`)) return true;

  return false;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
