// ---------------------------------------------------------------------------
// OKrunit -- Approval Conditions Evaluation
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAndCheckUrl } from "@/lib/api/ssrf";
import type { ApprovalCondition } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConditionCheckResult {
  allMet: boolean;
  conditions: ApprovalCondition[];
}

// ---------------------------------------------------------------------------
// Webhook Condition Evaluation
// ---------------------------------------------------------------------------

const CONDITION_WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Call a webhook URL and determine whether the condition is met.
 * A 2xx response means "met", anything else means "failed".
 * Returns the new status and a result payload for logging.
 */
async function evaluateWebhookCondition(
  condition: ApprovalCondition,
): Promise<{ status: "met" | "failed"; checkResult: Record<string, unknown> }> {
  if (!condition.webhook_url) {
    return {
      status: "failed",
      checkResult: { error: "No webhook_url configured" },
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    CONDITION_WEBHOOK_TIMEOUT_MS,
  );

  try {
    // Defense-in-depth SSRF check at evaluation time
    const isPrivate = await resolveAndCheckUrl(condition.webhook_url);
    if (isPrivate) {
      return { status: "failed" as const, checkResult: { error: "Webhook URL targets a private network" } };
    }

    const response = await fetch(condition.webhook_url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-OKrunit-Condition-Id": condition.id,
        "X-OKrunit-Request-Id": condition.request_id,
      },
      signal: controller.signal,
    });

    let responseBody: string | null = null;
    try {
      responseBody = await response.text();
    } catch {
      // Ignore body read errors
    }

    const met = response.status >= 200 && response.status < 300;

    return {
      status: met ? "met" : "failed",
      checkResult: {
        http_status: response.status,
        response_body: responseBody?.slice(0, 2000) ?? null,
        checked_at: new Date().toISOString(),
      },
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof DOMException && error.name === "AbortError"
        ? `Webhook timed out after ${CONDITION_WEBHOOK_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      status: "failed",
      checkResult: {
        error: errorMessage,
        checked_at: new Date().toISOString(),
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Core Condition Checking
// ---------------------------------------------------------------------------

/**
 * Fetch all conditions for a request. For webhook conditions that are still
 * pending, call the webhook and update their status. Returns whether all
 * conditions are now met.
 *
 * This function is safe to call multiple times (idempotent for already-resolved
 * conditions).
 */
export async function checkConditions(
  requestId: string,
): Promise<ConditionCheckResult> {
  const admin = createAdminClient();

  const { data: conditions, error } = await admin
    .from("approval_conditions")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error || !conditions) {
    console.error("[Conditions] Failed to fetch conditions:", error);
    return { allMet: false, conditions: [] };
  }

  if (conditions.length === 0) {
    return { allMet: true, conditions: [] };
  }

  const now = new Date().toISOString();
  const updatedConditions: ApprovalCondition[] = [];

  for (const condition of conditions as ApprovalCondition[]) {
    // Only check pending webhook conditions
    if (condition.status === "pending" && condition.check_type === "webhook") {
      const result = await evaluateWebhookCondition(condition);

      // Update the condition in the database
      const { data: updated } = await admin
        .from("approval_conditions")
        .update({
          status: result.status,
          checked_at: now,
          check_result: result.checkResult,
        })
        .eq("id", condition.id)
        .select("*")
        .single();

      updatedConditions.push((updated as ApprovalCondition) ?? {
        ...condition,
        status: result.status,
        checked_at: now,
        check_result: result.checkResult,
      });
    } else {
      updatedConditions.push(condition);
    }
  }

  const allMet = updatedConditions.every((c) => c.status === "met");

  // Update the parent approval's conditions_met flag
  await admin
    .from("approval_requests")
    .update({ conditions_met: allMet })
    .eq("id", requestId);

  return { allMet, conditions: updatedConditions };
}
