// ---------------------------------------------------------------------------
// OKrunit -- Cron: Process Webhook Retry Queue
// ---------------------------------------------------------------------------
// Runs every minute. Picks up due rows from webhook_retry_queue, attempts
// delivery, and updates status. Auto-pauses connections with 10+ consecutive
// failures.
//
// Auth: x-cron-secret header (same pattern as other cron routes)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import { resolveAndCheckUrl } from "@/lib/api/ssrf";
import {
  attemptWebhookDelivery,
  WEBHOOK_RETRY_DELAYS_MS,
} from "@/lib/api/callbacks";
import { captureError } from "@/lib/monitoring/capture";

/** Number of consecutive webhook failures before auto-pausing a connection. */
const AUTO_PAUSE_THRESHOLD = 10;

/** Maximum rows to process per cron invocation. */
const BATCH_SIZE = 50;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Fetch due retry rows
  const { data: rows, error: fetchError } = await admin
    .from("webhook_retry_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[Webhook Cron] Failed to fetch retry queue:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch queue" },
      { status: 500 },
    );
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0, delivered: 0, failed: 0 });
  }

  let delivered = 0;
  let failed = 0;
  let permanentlyFailed = 0;

  // 2. Process each row
  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        // SSRF check before retry delivery
        const isPrivate = await resolveAndCheckUrl(row.callback_url);
        if (isPrivate) {
          throw new Error("Callback URL targets a private network");
        }

        const result = await attemptWebhookDelivery(
          row.callback_url,
          row.payload as Record<string, unknown>,
          (row.callback_headers as Record<string, string>) ?? undefined,
        );

        // Log this attempt
        try {
          await admin.from("webhook_delivery_log").insert({
            request_id: row.request_id,
            connection_id: row.connection_id,
            url: row.callback_url,
            method: "POST",
            request_headers: {
              "Content-Type": "application/json",
              ...(row.callback_headers as Record<string, string>),
            },
            request_body: row.payload,
            response_status: result.responseStatus,
            response_headers: result.responseHeaders,
            response_body: result.responseBody,
            duration_ms: result.durationMs,
            attempt_number: row.attempt_count + 1,
            success: result.success,
            error_message: result.errorMessage,
          });
        } catch (logErr) {
          console.error(
            `[Webhook Cron] Failed to log delivery for queue row ${row.id}:`,
            logErr,
          );
        }

        if (result.success) {
          // Mark as delivered
          await admin
            .from("webhook_retry_queue")
            .update({
              status: "delivered",
              attempt_count: row.attempt_count + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          // Reset consecutive failures on the connection
          if (row.connection_id) {
            await admin
              .from("connections")
              .update({ consecutive_webhook_failures: 0 })
              .eq("id", row.connection_id);
          }

          delivered++;
        } else {
          const newAttemptCount = row.attempt_count + 1;

          if (newAttemptCount >= row.max_attempts) {
            // Permanently failed
            await admin
              .from("webhook_retry_queue")
              .update({
                status: "failed_permanent",
                attempt_count: newAttemptCount,
                last_error: result.errorMessage,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);

            permanentlyFailed++;
          } else {
            // Schedule next retry with exponential backoff
            // attempt_count is 0-indexed for delays: attempt 1 used delay[0],
            // so attempt N uses delay[N-1]. The inline attempt was #1,
            // so queued attempts start from delay index (newAttemptCount - 1).
            const delayIndex = Math.min(
              newAttemptCount - 1,
              WEBHOOK_RETRY_DELAYS_MS.length - 1,
            );
            const delayMs = WEBHOOK_RETRY_DELAYS_MS[delayIndex];
            const nextAttemptAt = new Date(
              Date.now() + delayMs,
            ).toISOString();

            await admin
              .from("webhook_retry_queue")
              .update({
                attempt_count: newAttemptCount,
                next_attempt_at: nextAttemptAt,
                last_error: result.errorMessage,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
          }

          // Increment consecutive failures on the connection
          if (row.connection_id) {
            const { data: conn } = await admin
              .from("connections")
              .select("consecutive_webhook_failures")
              .eq("id", row.connection_id)
              .single();

            if (conn) {
              const newFailures = (conn.consecutive_webhook_failures ?? 0) + 1;
              const updates: Record<string, unknown> = {
                consecutive_webhook_failures: newFailures,
              };

              // Auto-pause if threshold reached
              if (newFailures >= AUTO_PAUSE_THRESHOLD) {
                updates.webhook_paused_at = new Date().toISOString();
                console.warn(
                  `[Webhook Cron] Auto-paused connection ${row.connection_id} ` +
                    `after ${newFailures} consecutive webhook failures`,
                );
              }

              await admin
                .from("connections")
                .update(updates)
                .eq("id", row.connection_id);
            }
          }

          failed++;
        }
      } catch (err) {
        failed++;
        captureError({
          error: err,
          service: "WebhookRetryCron",
          tags: { queue_row_id: row.id, request_id: row.request_id },
        }).catch(() => {});
      }
    }),
  );

  return NextResponse.json({
    processed: rows.length,
    delivered,
    failed,
    permanently_failed: permanentlyFailed,
  });
}
