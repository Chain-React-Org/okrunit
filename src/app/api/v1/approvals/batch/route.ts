// ---------------------------------------------------------------------------
// OKrunit -- Batch Approvals API: POST (batch approve/reject)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { batchApprovalSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { deliverCallback } from "@/lib/api/callbacks";
import { checkIpRateLimit, getClientIp, WRITE_RATE_LIMIT, rateLimitResponse } from "@/lib/api/ip-rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- POST /api/v1/approvals/batch ----------------------------------------

export async function POST(request: Request) {
  // Rate limit check
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`batch:${ip}`, WRITE_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    // 1. Authenticate -- session only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can batch-process approvals",
        "SESSION_REQUIRED",
      );
    }

    // Check approval permission
    if (!auth.membership.can_approve) {
      throw new ApiError(
        403,
        "You do not have approval permissions",
        "NOT_APPROVER",
      );
    }

    const actorId = auth.user.id;

    // 2. Validate body
    const body = await request.json();
    const validated = batchApprovalSchema.parse(body);

    const admin = createAdminClient();
    const ipAddress = getIpAddress(request);

    // 3. Process each approval in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      validated.ids.map(async (approvalId) => {
        // 3a. Fetch the approval scoped to org
        const { data: approval, error: fetchError } = await admin
          .from("approval_requests")
          .select("*")
          .eq("id", approvalId)
          .eq("org_id", auth.orgId)
          .single();

        if (fetchError || !approval) {
          throw new Error("Approval request not found");
        }

        // 3b. Check status is pending
        if (approval.status !== "pending") {
          throw new Error("Approval is not pending");
        }

        // 3c. Lazy expiration check
        if (
          approval.expires_at &&
          approval.expires_at < new Date().toISOString()
        ) {
          await admin
            .from("approval_requests")
            .update({ status: "expired" })
            .eq("id", approvalId);

          throw new Error("Approval has expired");
        }

        // 3d. Apply decision -- handle multi-approver logic
        const decidedAt = new Date().toISOString();
        const isMultiApprover = approval.required_approvals > 1;

        let updated: typeof approval;

        if (isMultiApprover) {
          // Check for duplicate votes
          const { data: existingVote } = await admin
            .from("approval_votes")
            .select("id")
            .eq("request_id", approvalId)
            .eq("user_id", actorId)
            .maybeSingle();

          if (existingVote) {
            throw new Error("You have already voted on this request");
          }

          // Insert the vote
          const { error: voteError } = await admin
            .from("approval_votes")
            .insert({
              request_id: approvalId,
              user_id: actorId,
              vote: validated.decision,
              comment: validated.comment ?? null,
              source: "dashboard" as const,
            });

          if (voteError) {
            if (voteError.code === "23505") {
              throw new Error("You have already voted on this request");
            }
            throw new Error("Failed to record vote");
          }

          if (validated.decision === "reject") {
            // Any rejection immediately rejects
            const { data: rejectedData, error: rejectError } = await admin
              .from("approval_requests")
              .update({
                status: "rejected",
                decided_by: actorId,
                decided_at: decidedAt,
                decision_comment: validated.comment ?? null,
                decision_source: "batch",
              })
              .eq("id", approvalId)
              .select("*")
              .single();

            if (rejectError || !rejectedData) {
              throw new Error("Failed to update approval request");
            }

            updated = rejectedData;
          } else {
            // Increment approval count
            const newCurrentApprovals = approval.current_approvals + 1;
            const thresholdMet =
              newCurrentApprovals >= approval.required_approvals;

            const updatePayload: Record<string, unknown> = {
              current_approvals: newCurrentApprovals,
            };

            if (thresholdMet) {
              updatePayload.status = "approved";
              updatePayload.decided_by = actorId;
              updatePayload.decided_at = decidedAt;
              updatePayload.decision_comment = validated.comment ?? null;
              updatePayload.decision_source = "batch";
            }

            const { data: approvedData, error: approveError } = await admin
              .from("approval_requests")
              .update(updatePayload)
              .eq("id", approvalId)
              .select("*")
              .single();

            if (approveError || !approvedData) {
              throw new Error("Failed to update approval request");
            }

            updated = approvedData;
          }
        } else {
          // Single-approver flow
          const newStatus =
            validated.decision === "approve" ? "approved" : "rejected";

          const { data: singleData, error: updateError } = await admin
            .from("approval_requests")
            .update({
              status: newStatus,
              decided_by: actorId,
              decided_at: decidedAt,
              decision_comment: validated.comment ?? null,
              decision_source: "batch",
            })
            .eq("id", approvalId)
            .select("*")
            .single();

          if (updateError || !singleData) {
            throw new Error("Failed to update approval request");
          }

          updated = singleData;
        }

        // 3e. Audit log
        logAuditEvent({
          orgId: auth.orgId,
          userId: actorId,
          action: `approval.${updated.status === "pending" ? `vote.${validated.decision}` : updated.status}`,
          resourceType: "approval_request",
          resourceId: approvalId,
          details: {
            decision: validated.decision,
            comment: validated.comment ?? null,
            source: "batch",
          },
          ipAddress,
        });

        // 3f. Callback delivery when a final decision is reached
        if (updated.status !== "pending" && approval.callback_url) {
          deliverCallback({
            requestId: approvalId,
            connectionId: approval.connection_id,
            callbackUrl: approval.callback_url,
            callbackHeaders:
              (approval.callback_headers as Record<string, string>) ??
              undefined,
            payload: {
              id: updated.id,
              status: updated.status,
              decided_by: updated.decided_by,
              decided_at: updated.decided_at,
              decision_comment: updated.decision_comment,
              title: updated.title,
              priority: updated.priority,
              metadata: updated.metadata,
            },
          });
        }

        return updated;
      }),
    );

    // 4. Compile response
    let processed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        processed += 1;
      } else {
        errors.push({
          id: validated.ids[index],
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    revalidateTags(CacheTags.requests(auth.orgId), CacheTags.overview(auth.orgId), CacheTags.analytics(auth.orgId));
    return NextResponse.json({ processed, errors });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
