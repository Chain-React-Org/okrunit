// ---------------------------------------------------------------------------
// OKrunit -- Callback / Webhook Delivery
// ---------------------------------------------------------------------------

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { CALLBACK_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/monitoring/logger";
import { resolveAndCheckUrl } from "./ssrf";

// ---------------------------------------------------------------------------
// Retry backoff schedule (delays in milliseconds)
// After the first inline attempt fails, the delivery is queued with
// exponential backoff: 1min, 5min, 30min, 2hr, 12hr, 24hr, 48hr.
// ---------------------------------------------------------------------------

export const WEBHOOK_RETRY_DELAYS_MS = [
  60_000,        // 1 minute
  300_000,       // 5 minutes
  1_800_000,     // 30 minutes
  7_200_000,     // 2 hours
  43_200_000,    // 12 hours
  86_400_000,    // 24 hours
  172_800_000,   // 48 hours
] as const;

export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_DELAYS_MS.length + 1; // 8 total (1 inline + 7 queued)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallbackParams {
  requestId: string;
  connectionId: string | null;
  callbackUrl: string;
  callbackHeaders?: Record<string, string>;
  payload: Record<string, unknown>;
}

/** Result of a single webhook delivery attempt. */
export interface DeliveryAttemptResult {
  success: boolean;
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute HMAC-SHA256 of `body` using the given `secret`. Returns hex digest. */
function computeHmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Truncate a string to `maxLen` characters. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// Single-attempt delivery (shared between inline and cron retry)
// ---------------------------------------------------------------------------

/**
 * Attempt a single HTTP POST delivery to the callback URL.
 * Does not retry. Returns a structured result.
 */
export async function attemptWebhookDelivery(
  callbackUrl: string,
  payload: Record<string, unknown>,
  callbackHeaders?: Record<string, string>,
): Promise<DeliveryAttemptResult> {
  const bodyString = JSON.stringify(payload);
  const hmacSecret = process.env.CALLBACK_HMAC_SECRET;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...callbackHeaders,
  };

  if (hmacSecret) {
    const signature = computeHmac(bodyString, hmacSecret);
    headers["X-OKrunit-Signature"] = `sha256=${signature}`;
    headers["X-OKrunit-Timestamp"] = String(Math.floor(Date.now() / 1000));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);

  let responseStatus: number | null = null;
  let responseHeaders: Record<string, string> | null = null;
  let responseBody: string | null = null;
  let durationMs: number | null = null;
  let success = false;
  let errorMessage: string | null = null;

  const startTime = Date.now();

  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers,
      body: bodyString,
      signal: controller.signal,
    });

    durationMs = Date.now() - startTime;
    responseStatus = response.status;

    const resHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });
    responseHeaders = resHeaders;

    const rawBody = await response.text();
    responseBody = truncate(rawBody, 10_000);

    success = response.status >= 200 && response.status < 300;

    if (!success) {
      errorMessage = `Non-2xx response: ${response.status}`;
    }
  } catch (fetchError: unknown) {
    durationMs = Date.now() - startTime;

    if (
      fetchError instanceof DOMException &&
      fetchError.name === "AbortError"
    ) {
      errorMessage = `Request timed out after ${CALLBACK_TIMEOUT_MS}ms`;
    } else if (fetchError instanceof Error) {
      errorMessage = fetchError.message;
    } else {
      errorMessage = String(fetchError);
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    success,
    responseStatus,
    responseHeaders,
    responseBody,
    durationMs,
    errorMessage,
  };
}

// ---------------------------------------------------------------------------
// Core Delivery
// ---------------------------------------------------------------------------

/**
 * Deliver a callback (webhook) to the connection's registered URL.
 *
 * - Signs the payload with HMAC-SHA256 when `CALLBACK_HMAC_SECRET` is set.
 * - Makes one immediate inline attempt.
 * - If the first attempt fails, queues the delivery in webhook_retry_queue
 *   with exponential backoff instead of blocking with inline retries.
 * - Logs the attempt to the `webhook_delivery_log` table.
 * - Never throws. Callback failure must not break the main request flow.
 *
 * This function is designed to be called fire-and-forget. The caller does
 * not await it (no `await` before `deliverCallback(...)`).
 */
export async function deliverCallback(params: CallbackParams): Promise<void> {
  const { requestId, connectionId, callbackUrl, callbackHeaders, payload } =
    params;

  // SSRF protection: block callbacks to private/internal networks (with DNS resolution)
  if (await resolveAndCheckUrl(callbackUrl)) {
    logger.warn(
      `[Callback] Blocked SSRF attempt: ${callbackUrl} for request ${requestId}`,
    );
    return;
  }

  try {
    const admin = createAdminClient();

    // -- Single inline attempt ------------------------------------------
    const result = await attemptWebhookDelivery(
      callbackUrl,
      payload,
      callbackHeaders,
    );

    // -- Log this attempt to the database --------------------------------
    try {
      await admin.from("webhook_delivery_log").insert({
        request_id: requestId,
        connection_id: connectionId,
        url: callbackUrl,
        method: "POST",
        request_headers: {
          "Content-Type": "application/json",
          ...callbackHeaders,
        },
        request_body: payload,
        response_status: result.responseStatus,
        response_headers: result.responseHeaders,
        response_body: result.responseBody,
        duration_ms: result.durationMs,
        attempt_number: 1,
        success: result.success,
        error_message: result.errorMessage,
      });
    } catch (logError) {
      logger.error(
        `[Callback] Failed to write delivery log for request ${requestId}:`,
        logError,
      );
    }

    // -- If successful, we are done --------------------------------------
    if (result.success) {
      return;
    }

    logger.warn(
      `[Callback] Inline attempt failed for request ${requestId} ` +
        `to ${callbackUrl}: ${result.errorMessage}. Queuing for retry.`,
    );

    // -- Queue for durable retry ----------------------------------------
    const nextAttemptAt = new Date(
      Date.now() + WEBHOOK_RETRY_DELAYS_MS[0],
    ).toISOString();

    try {
      await admin.from("webhook_retry_queue").insert({
        request_id: requestId,
        connection_id: connectionId,
        callback_url: callbackUrl,
        callback_headers: callbackHeaders ?? {},
        payload,
        attempt_count: 1, // The inline attempt counts as attempt #1
        max_attempts: WEBHOOK_MAX_ATTEMPTS,
        next_attempt_at: nextAttemptAt,
        last_error: result.errorMessage,
        status: "pending",
      });
    } catch (queueError) {
      logger.error(
        `[Callback] Failed to queue retry for request ${requestId}:`,
        queueError,
      );
    }
  } catch (outerError) {
    // Catch-all: callback delivery must never propagate exceptions.
    logger.error(
      `[Callback] Unexpected error delivering callback for request ${requestId}:`,
      outerError,
    );
  }
}
