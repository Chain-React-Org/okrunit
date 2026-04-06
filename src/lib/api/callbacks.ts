// ---------------------------------------------------------------------------
// OKrunit -- Callback / Webhook Delivery
// ---------------------------------------------------------------------------

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_CALLBACK_RETRIES,
  CALLBACK_TIMEOUT_MS,
  CALLBACK_RETRY_DELAYS,
} from "@/lib/constants";
import { isPrivateUrl } from "./ssrf";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute HMAC-SHA256 of `body` using the given `secret`. Returns hex digest. */
function computeHmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Simple delay helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// isPrivateUrl is imported from ./ssrf.ts

/** Truncate a string to `maxLen` characters. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// Core Delivery
// ---------------------------------------------------------------------------

/**
 * Deliver a callback (webhook) to the connection's registered URL.
 *
 * - Signs the payload with HMAC-SHA256 when `CALLBACK_HMAC_SECRET` is set.
 * - Retries up to MAX_CALLBACK_RETRIES times with exponential back-off.
 * - Logs every attempt to the `webhook_delivery_log` table.
 * - Never throws -- callback failure must not break the main request flow.
 *
 * This function is designed to be called fire-and-forget. The caller does
 * not await it (no `await` before `deliverCallback(...)`).
 */
export async function deliverCallback(params: CallbackParams): Promise<void> {
  const { requestId, connectionId, callbackUrl, callbackHeaders, payload } =
    params;

  // SSRF protection: block callbacks to private/internal networks
  if (isPrivateUrl(callbackUrl)) {
    console.warn(`[Callback] Blocked SSRF attempt: ${callbackUrl} for request ${requestId}`);
    return;
  }

  const bodyString = JSON.stringify(payload);
  const hmacSecret = process.env.CALLBACK_HMAC_SECRET;

  try {
    const admin = createAdminClient();

    for (let attempt = 1; attempt <= MAX_CALLBACK_RETRIES; attempt++) {
      // If this is a retry, wait before the next attempt.
      if (attempt > 1) {
        const delay = CALLBACK_RETRY_DELAYS[attempt - 1] ?? 4_000;
        await sleep(delay);
      }

      // -- Build headers ------------------------------------------------
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...callbackHeaders,
      };

      if (hmacSecret) {
        const signature = computeHmac(bodyString, hmacSecret);
        headers["X-OKrunit-Signature"] = `sha256=${signature}`;
        headers["X-OKrunit-Timestamp"] = String(
          Math.floor(Date.now() / 1000),
        );
      }

      // -- Perform the request ------------------------------------------
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CALLBACK_TIMEOUT_MS,
      );

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

        // Collect response headers as a plain object.
        const resHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          resHeaders[key] = value;
        });
        responseHeaders = resHeaders;

        // Read response body, truncating to 10 KB.
        const rawBody = await response.text();
        responseBody = truncate(rawBody, 10_000);

        success = response.status >= 200 && response.status < 300;

        if (!success) {
          errorMessage = `Non-2xx response: ${response.status}`;
        }
      } catch (fetchError: unknown) {
        durationMs = Date.now() - startTime;

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          errorMessage = `Request timed out after ${CALLBACK_TIMEOUT_MS}ms`;
        } else if (fetchError instanceof Error) {
          errorMessage = fetchError.message;
        } else {
          errorMessage = String(fetchError);
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // -- Log this attempt to the database ------------------------------
      try {
        await admin.from("webhook_delivery_log").insert({
          request_id: requestId,
          connection_id: connectionId,
          url: callbackUrl,
          method: "POST",
          request_headers: headers,
          request_body: payload,
          response_status: responseStatus,
          response_headers: responseHeaders,
          response_body: responseBody,
          duration_ms: durationMs,
          attempt_number: attempt,
          success,
          error_message: errorMessage,
        });
      } catch (logError) {
        console.error(
          `[Callback] Failed to write delivery log for request ${requestId}, attempt ${attempt}:`,
          logError,
        );
      }

      // -- If successful, stop retrying ----------------------------------
      if (success) {
        return;
      }

      console.warn(
        `[Callback] Attempt ${attempt}/${MAX_CALLBACK_RETRIES} failed ` +
          `for request ${requestId} to ${callbackUrl}: ${errorMessage}`,
      );
    }

    // All attempts exhausted.
    console.error(
      `[Callback] All ${MAX_CALLBACK_RETRIES} attempts exhausted ` +
        `for request ${requestId} to ${callbackUrl}. Giving up.`,
    );
  } catch (outerError) {
    // Catch-all: callback delivery must never propagate exceptions.
    console.error(
      `[Callback] Unexpected error delivering callback for request ${requestId}:`,
      outerError,
    );
  }
}
