// ---------------------------------------------------------------------------
// OKrunit -- monday.com Webhook Authentication
// ---------------------------------------------------------------------------
// Verifies that incoming monday.com webhook/action/trigger requests carry
// a valid authorization token matching the MONDAY_SIGNING_SECRET.
// ---------------------------------------------------------------------------

import { timingSafeEqual } from "crypto";

/**
 * Verify that a monday.com webhook request is authentic.
 * monday.com sends the signing secret as `authorization` header.
 * Returns the verified org_id or null if auth fails.
 */
export function verifyMondayAuth(request: Request): boolean {
  const secret = process.env.MONDAY_SIGNING_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader) return false;

  if (authHeader.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(secret));
}
