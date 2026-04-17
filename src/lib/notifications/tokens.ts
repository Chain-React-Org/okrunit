// ---------------------------------------------------------------------------
// OKrunit -- Email Action Token Management
// ---------------------------------------------------------------------------

import { randomBytes } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api/auth";
import { EMAIL_TOKEN_EXPIRY_HOURS } from "@/lib/constants";
import { logger } from "@/lib/monitoring/logger";
import type { EmailAction } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionTokenPair {
  approveToken: string;
  rejectToken: string;
}

export interface ValidatedTokenAction {
  requestId: string;
  userId: string;
  action: EmailAction;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a pair of email action tokens (approve + reject) for a specific
 * user and request.
 *
 * Both tokens are stored in the `email_action_tokens` table with an expiry
 * of `EMAIL_TOKEN_EXPIRY_HOURS` from now. Each token is a 32-byte random
 * hex string (64 characters) -- sufficiently random to be unguessable.
 */
export async function generateActionTokens(
  requestId: string,
  userId: string,
): Promise<ActionTokenPair> {
  const approveToken = randomBytes(32).toString("hex");
  const rejectToken = randomBytes(32).toString("hex");

  const expiresAt = new Date(
    Date.now() + EMAIL_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const admin = createAdminClient();

  const { error } = await admin.from("email_action_tokens").insert([
    {
      request_id: requestId,
      user_id: userId,
      action: "approve" as EmailAction,
      token: hashApiKey(approveToken),
      expires_at: expiresAt,
    },
    {
      request_id: requestId,
      user_id: userId,
      action: "reject" as EmailAction,
      token: hashApiKey(rejectToken),
      expires_at: expiresAt,
    },
  ]);

  if (error) {
    logger.error("[Tokens] Failed to insert email action tokens:", error);
    throw new Error("Failed to generate email action tokens");
  }

  return { approveToken, rejectToken };
}

/**
 * Validate and consume a single-use email action token.
 *
 * Returns the action details (request ID, user ID, action type) if the token
 * is valid, has not been consumed, and has not expired. Marks the token as
 * consumed (sets `consumed_at`) so it cannot be reused.
 *
 * Returns `null` if the token is invalid, already consumed, or expired.
 */
export async function validateAndConsumeToken(
  token: string,
): Promise<ValidatedTokenAction | null> {
  const admin = createAdminClient();

  // Look up the token.
  const { data: row, error: lookupError } = await admin
    .from("email_action_tokens")
    .select("*")
    .eq("token", hashApiKey(token))
    .maybeSingle();

  if (lookupError) {
    logger.error("[Tokens] Failed to look up email action token:", lookupError);
    return null;
  }

  if (!row) {
    return null;
  }

  // Check: not consumed.
  if (row.consumed_at) {
    return null;
  }

  // Check: not expired.
  if (new Date(row.expires_at) < new Date()) {
    return null;
  }

  // Mark as consumed atomically. The `.is("consumed_at", null)` guard
  // prevents a race where two concurrent requests both read the token
  // before either marks it consumed.
  const { data: consumed, error: consumeError } = await admin
    .from("email_action_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) {
    logger.error("[Tokens] Failed to mark token as consumed:", consumeError);
    // Either the update failed or another request already consumed the
    // token. Return null to be safe.
    return null;
  }

  return {
    requestId: row.request_id,
    userId: row.user_id,
    action: row.action as EmailAction,
  };
}
