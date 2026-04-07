// ---------------------------------------------------------------------------
// OKrunit -- Central Error Capture
// ---------------------------------------------------------------------------
// Fire-and-forget error capture. Writes to error_issues + error_events
// tables via service-role client. Triggers Discord alerts for new issues
// and regressions.
//
// Follows the same pattern as logAuditEvent() in src/lib/api/audit.ts:
// uses createAdminClient(), catches its own errors, never throws.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { generateFingerprint } from "./fingerprint";
import { sendErrorDiscordAlert } from "./discord-alerts";
import { getBreadcrumbs } from "./breadcrumbs";
import type { CaptureErrorParams, ErrorSeverity } from "./types";

/** Current release. Read once from env. */
const RELEASE =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_GIT_SHA ??
  null;

const ENVIRONMENT = process.env.NODE_ENV ?? "production";

/**
 * Capture an error and store it in the monitoring system.
 * Fire-and-forget. Never throws.
 */
export async function captureError(params: CaptureErrorParams): Promise<void> {
  try {
    const { type, message, stack } = extractErrorInfo(params.error);
    const fingerprint = generateFingerprint(params.error);
    const severity = params.severity ?? "error";
    const breadcrumbs =
      params.breadcrumbs ?? getBreadcrumbs();

    const admin = createAdminClient();

    // 1. Check if issue exists
    const { data: existing } = await admin
      .from("error_issues")
      .select("id, status, event_count, resolved_in_release")
      .eq("fingerprint", fingerprint)
      .single();

    let issueId: string;
    let isNew = false;
    let isRegression = false;
    let eventCount = 1;

    if (!existing) {
      // 2a. New issue - insert
      isNew = true;
      const { data: inserted, error: insertErr } = await admin
        .from("error_issues")
        .insert({
          fingerprint,
          title: `${type}: ${message}`.slice(0, 500),
          severity,
          status: "unresolved",
          service: params.service ?? null,
          event_count: 1,
          affected_users: params.userId ? 1 : 0,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          first_release: RELEASE,
          last_release: RELEASE,
          tags: params.tags ?? {},
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        console.error("[ErrorMonitor] Failed to insert issue:", insertErr);
        return;
      }
      issueId = inserted.id;
    } else {
      // 2b. Existing issue - update
      issueId = existing.id;
      eventCount = existing.event_count + 1;

      // Detect regression: was resolved, now reappearing
      // Also check if it reappears in a different release than where it was resolved
      if (
        existing.status === "resolved" &&
        (!existing.resolved_in_release ||
          existing.resolved_in_release !== RELEASE)
      ) {
        isRegression = true;
      }

      const updateData: Record<string, unknown> = {
        event_count: eventCount,
        last_seen_at: new Date().toISOString(),
        last_release: RELEASE,
      };

      if (isRegression) {
        updateData.status = "regressed";
      }

      await admin.from("error_issues").update(updateData).eq("id", issueId);
    }

    // 3. Insert error event
    await admin.from("error_events").insert({
      issue_id: issueId,
      error_type: type,
      message: message.slice(0, 2000),
      stack_trace: stack ?? null,
      severity,
      service: params.service ?? null,
      environment: ENVIRONMENT,
      release: RELEASE,
      request_url: params.requestUrl ?? null,
      request_method: params.requestMethod ?? null,
      user_id: params.userId ?? null,
      org_id: params.orgId ?? null,
      tags: params.tags ?? {},
      context: params.context ?? {},
      breadcrumbs,
    });

    // 4. Update affected users count (if we have a user_id)
    if (params.userId) {
      const { count } = await admin
        .from("error_events")
        .select("user_id", { count: "exact", head: true })
        .eq("issue_id", issueId)
        .not("user_id", "is", null);

      // Use a rough unique count. Exact distinct requires RPC
      // For now, the event count with user_id is a reasonable proxy
      if (count !== null) {
        await admin
          .from("error_issues")
          .update({ affected_users: count })
          .eq("id", issueId);
      }
    }

    // 5. Send Discord alert for new issues and regressions
    if (isNew || isRegression) {
      // Look up user/org names for richer Discord alerts
      let userName: string | undefined;
      let orgName: string | undefined;

      if (params.userId || params.orgId) {
        try {
          const [userResult, orgResult] = await Promise.all([
            params.userId
              ? admin.from("user_profiles").select("full_name, email").eq("id", params.userId).single()
              : Promise.resolve({ data: null }),
            params.orgId
              ? admin.from("organizations").select("name").eq("id", params.orgId).single()
              : Promise.resolve({ data: null }),
          ]);
          if (userResult.data) {
            userName = userResult.data.full_name || userResult.data.email;
          }
          if (orgResult.data) {
            orgName = orgResult.data.name;
          }
        } catch {
          // Names are optional - continue without them
        }
      }

      sendErrorDiscordAlert({
        issueId,
        fingerprint,
        title: `${type}: ${message}`.slice(0, 200),
        severity,
        stackSnippet: stack ?? "No stack trace",
        service: params.service,
        requestUrl: params.requestUrl,
        userId: params.userId,
        userName,
        orgId: params.orgId,
        orgName,
        isRegression,
        eventCount,
      }).catch(() => {
        // Swallow. Discord alert failure should never propagate
      });
    }
  } catch (err) {
    // The error monitor itself must never crash the app
    console.error("[ErrorMonitor] captureError failed:", err);
  }
}

/** Extract type, message, and stack from any thrown value. */
function extractErrorInfo(error: unknown): {
  type: string;
  message: string;
  stack: string | null;
} {
  if (error instanceof Error) {
    return {
      type: error.constructor.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string") {
    return { type: "StringError", message: error, stack: null };
  }

  try {
    return {
      type: "UnknownError",
      message: JSON.stringify(error),
      stack: null,
    };
  } catch {
    return { type: "UnknownError", message: String(error), stack: null };
  }
}
