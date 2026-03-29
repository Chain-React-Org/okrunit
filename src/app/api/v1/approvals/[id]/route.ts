// ---------------------------------------------------------------------------
// OKRunit -- Approvals API: GET (single) + PATCH (respond) + DELETE (cancel)
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { respondApprovalSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { deliverCallback } from "@/lib/api/callbacks";
import { checkConditions } from "@/lib/api/conditions";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotifications } from "@/lib/notifications/orchestrator";
import { findDelegationForDelegate } from "@/lib/api/delegation";
import { updateTrustCounter } from "@/lib/api/trust-engine";
import { checkSlaBreach } from "@/lib/api/sla";
import { validateSecurityContext } from "@/lib/api/geo-security";
import { checkFourEyes } from "@/lib/api/four-eyes";
import { checkReauthRequired } from "@/lib/api/session-security";
import type { RejectionReasonPolicy, ApprovalPriority } from "@/lib/types/database";

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Look up a user's display name (full_name or email) by ID. */
async function getUserDisplayName(
  admin: ReturnType<typeof createAdminClient>,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await admin
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return data.full_name || data.email || null;
}

/**
 * Fetch a single approval by id scoped to the org. Throws 404 if not found.
 */
async function fetchApproval(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  orgId: string,
) {
  const { data: approval, error } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !approval) {
    throw new ApiError(404, "Approval request not found", "NOT_FOUND");
  }

  return approval;
}

/**
 * Lazy expiration check. If the approval is pending and past its expiry time,
 * update its status to expired and throw a 409 (or return the updated record).
 * Returns true if the approval was expired.
 */
async function checkAndExpire(
  admin: ReturnType<typeof createAdminClient>,
  approval: { id: string; status: string; expires_at: string | null },
): Promise<boolean> {
  if (
    approval.status === "pending" &&
    approval.expires_at &&
    approval.expires_at < new Date().toISOString()
  ) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);

    return true;
  }
  return false;
}

/**
 * Lazy auto-action check. If the approval is pending and past its auto_action_deadline,
 * apply the configured auto-action (approve/reject). Returns the updated fields
 * or null if no auto-action was taken.
 */
async function checkAndApplyAutoAction(
  admin: ReturnType<typeof createAdminClient>,
  approval: {
    id: string;
    status: string;
    auto_action?: string | null;
    auto_action_deadline?: string | null;
  },
): Promise<{ status: string; decided_at: string; decision_source: string; auto_approved: boolean } | null> {
  if (
    approval.status === "pending" &&
    approval.auto_action &&
    approval.auto_action_deadline &&
    approval.auto_action_deadline < new Date().toISOString()
  ) {
    const now = new Date().toISOString();
    const newStatus = approval.auto_action === "approve" ? "approved" : "rejected";

    await admin
      .from("approval_requests")
      .update({
        status: newStatus,
        decided_at: now,
        decision_source: "auto_rule",
        auto_approved: approval.auto_action === "approve",
      })
      .eq("id", approval.id)
      .eq("status", "pending"); // guard against races

    return {
      status: newStatus,
      decided_at: now,
      decision_source: "auto_rule",
      auto_approved: approval.auto_action === "approve",
    };
  }

  return null;
}

/**
 * Determine if a callback should be delivered for an approved request, taking
 * into account scheduled execution and unmet conditions. Returns true if the
 * callback should be delivered immediately.
 */
function shouldDeliverCallback(approval: {
  execution_status?: string;
  scheduled_execution_at?: string | null;
  conditions_met?: boolean;
}): boolean {
  // If execution is scheduled for the future, don't deliver yet
  if (approval.execution_status === "scheduled") {
    return false;
  }
  // If conditions are not met, don't deliver yet
  if (approval.conditions_met === false) {
    return false;
  }
  return true;
}

// ---- GET /api/v1/approvals/[id] -------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate (both types)
    const auth = await authenticateRequest(request);
    const admin = createAdminClient();

    // 2. Fetch single approval
    const approval = await fetchApproval(admin, id, auth.orgId);

    // 3. Lazy expiration check
    const expired = await checkAndExpire(admin, approval);
    if (expired) {
      return NextResponse.json(
        { ...approval, status: "expired", decided_by_name: null },
      );
    }

    // 3b. Lazy auto-action deadline check
    const autoActioned = await checkAndApplyAutoAction(admin, approval);
    if (autoActioned) {
      return NextResponse.json({
        ...approval,
        ...autoActioned,
        decided_by_name: null,
      });
    }

    // 3b2. Lazy SLA breach check
    if (checkSlaBreach(approval)) {
      // Mark as breached (fire-and-forget)
      admin
        .from("approval_requests")
        .update({
          sla_breached: true,
          sla_breached_at: new Date().toISOString(),
        })
        .eq("id", approval.id)
        .eq("sla_breached", false)
        .then();

      // Notify about the breach (fire-and-forget)
      dispatchNotifications({
        type: "approval.sla_breached",
        orgId: auth.orgId,
        requestId: approval.id,
        requestTitle: approval.title,
        requestPriority: approval.priority,
        connectionId: approval.connection_id ?? undefined,
      });

      // Update local object for the response
      approval.sla_breached = true;
      approval.sla_breached_at = new Date().toISOString();
    }

    // 3c. Lazy scheduled execution check
    if (
      approval.execution_status === "scheduled" &&
      approval.scheduled_execution_at &&
      approval.scheduled_execution_at < new Date().toISOString() &&
      approval.status === "approved"
    ) {
      // Time has arrived -- execute the callback and mark as executed
      after(async () => {
        const execAdmin = createAdminClient();
        await execAdmin
          .from("approval_requests")
          .update({ execution_status: "executed" })
          .eq("id", approval.id)
          .eq("execution_status", "scheduled"); // guard against races

        if (approval.callback_url) {
          const decidedByName = await getUserDisplayName(execAdmin, approval.decided_by);
          await deliverCallback({
            requestId: approval.id,
            connectionId: approval.connection_id,
            callbackUrl: approval.callback_url,
            callbackHeaders:
              (approval.callback_headers as Record<string, string>) ?? undefined,
            payload: {
              id: approval.id,
              status: approval.status,
              decided_by: approval.decided_by,
              decided_by_name: decidedByName,
              decided_at: approval.decided_at,
              decision_comment: approval.decision_comment,
              title: approval.title,
              priority: approval.priority,
              metadata: approval.metadata,
              execution_status: "executed",
            },
          });
        }
      });

      // Return the updated state immediately
      const decidedByName = await getUserDisplayName(admin, approval.decided_by);
      return NextResponse.json({
        ...approval,
        execution_status: "executed",
        decided_by_name: decidedByName,
      });
    }

    // 3d. Lazy condition check for approved approvals with unmet conditions
    if (
      approval.status === "approved" &&
      approval.conditions_met === false
    ) {
      const conditionResult = await checkConditions(approval.id);
      if (conditionResult.allMet && approval.callback_url) {
        // All conditions now met -- deliver the callback fire-and-forget
        const decidedByName = await getUserDisplayName(admin, approval.decided_by);
        after(
          deliverCallback({
            requestId: approval.id,
            connectionId: approval.connection_id,
            callbackUrl: approval.callback_url,
            callbackHeaders:
              (approval.callback_headers as Record<string, string>) ?? undefined,
            payload: {
              id: approval.id,
              status: approval.status,
              decided_by: approval.decided_by,
              decided_by_name: decidedByName,
              decided_at: approval.decided_at,
              decision_comment: approval.decision_comment,
              title: approval.title,
              priority: approval.priority,
              metadata: approval.metadata,
              conditions_met: true,
            },
          })
        );
      }
    }

    // 4. Compute rejection_reason_required for frontend/integration hint
    let rejectionReasonRequired = false;
    if (approval.status === "pending") {
      if (approval.require_rejection_reason) {
        rejectionReasonRequired = true;
      } else {
        const { data: orgSettings } = await admin
          .from("organizations")
          .select("rejection_reason_policy")
          .eq("id", auth.orgId)
          .single();

        const policy = (orgSettings?.rejection_reason_policy ?? "optional") as RejectionReasonPolicy;
        if (policy === "required") {
          rejectionReasonRequired = true;
        } else if (
          policy === "required_high_critical" &&
          (approval.priority === "high" || approval.priority === "critical")
        ) {
          rejectionReasonRequired = true;
        }
      }
    }

    // 5. Enrich with decided_by_name
    const decidedByName = await getUserDisplayName(admin, approval.decided_by);
    return NextResponse.json({
      ...approval,
      decided_by_name: decidedByName,
      rejection_reason_required: rejectionReasonRequired,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---- PATCH /api/v1/approvals/[id] -----------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can respond to approvals",
        "SESSION_REQUIRED",
      );
    }

    // 1b. Check approval permission
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
    const validated = respondApprovalSchema.parse(body);

    const admin = createAdminClient();

    // 2b. Fetch org settings for security checks
    const { data: orgSettings } = await admin
      .from("organizations")
      .select("ip_allowlist, geo_restrictions, four_eyes_config, require_reauth_for_critical, session_timeout_minutes")
      .eq("id", auth.orgId)
      .single();

    // 2c. Geo-fencing: IP allowlist + country restriction
    let geoIp: string | undefined;
    let geoCountry: string | null | undefined;
    if (orgSettings) {
      const securityResult = validateSecurityContext(request, orgSettings);
      geoIp = securityResult.ip;
      geoCountry = securityResult.country;
      if (!securityResult.allowed) {
        logAuditEvent({
          orgId: auth.orgId,
          userId: actorId,
          action: "security.geo_blocked",
          resourceType: "approval_request",
          resourceId: id,
          details: {
            ip: securityResult.ip,
            country: securityResult.country,
            reason: securityResult.reason,
          },
          ipAddress: securityResult.ip,
        });

        throw new ApiError(403, securityResult.reason ?? "Access denied by security policy", "GEO_BLOCKED");
      }
    }

    // 3. Fetch the approval
    const approval = await fetchApproval(admin, id, auth.orgId);

    // 4. Check status is pending
    if (approval.status !== "pending") {
      throw new ApiError(
        409,
        "Approval is not pending",
        "NOT_PENDING",
      );
    }

    // 5. Lazy expiration check
    const expired = await checkAndExpire(admin, approval);
    if (expired) {
      throw new ApiError(409, "Approval has expired", "EXPIRED");
    }

    // 5a. Lazy auto-action deadline check
    const autoActioned = await checkAndApplyAutoAction(admin, approval);
    if (autoActioned) {
      throw new ApiError(
        409,
        `Approval was auto-${autoActioned.status} due to deadline`,
        "AUTO_ACTIONED",
      );
    }

    // 5b1. Four-eyes principle check
    if (orgSettings) {
      const fourEyesResult = checkFourEyes(orgSettings, approval, actorId);
      if (!fourEyesResult.allowed) {
        logAuditEvent({
          orgId: auth.orgId,
          userId: actorId,
          action: "security.four_eyes_blocked",
          resourceType: "approval_request",
          resourceId: id,
          details: { reason: fourEyesResult.reason },
          ipAddress: getIpAddress(request),
        });

        throw new ApiError(403, fourEyesResult.reason ?? "Self-approval blocked", "SELF_APPROVAL_BLOCKED");
      }
    }

    // 5b2. Re-authentication check for critical approvals
    if (orgSettings && orgSettings.require_reauth_for_critical && approval.priority === "critical") {
      // Fetch the user's metadata to get last_reauth_at
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(actorId);
      const lastReauthAt = (authUser?.user_metadata?.last_reauth_at as string) ?? null;
      const reauthResult = checkReauthRequired(orgSettings, approval, lastReauthAt);
      if (reauthResult.required) {
        throw new ApiError(401, reauthResult.reason ?? "Re-authentication required", "REAUTH_REQUIRED");
      }
    }

    // 5b. If rejecting, enforce rejection reason requirements
    if (validated.decision === "reject") {
      const commentProvided = validated.comment && validated.comment.trim().length > 0;

      if (!commentProvided) {
        // Check per-request override first
        if (approval.require_rejection_reason) {
          throw new ApiError(
            400,
            "A rejection reason is required",
            "REJECTION_REASON_REQUIRED",
          );
        }

        // Check org-level policy
        const { data: orgSettings } = await admin
          .from("organizations")
          .select("rejection_reason_policy")
          .eq("id", auth.orgId)
          .single();

        const policy = (orgSettings?.rejection_reason_policy ?? "optional") as RejectionReasonPolicy;

        if (policy === "required") {
          throw new ApiError(
            400,
            "A rejection reason is required",
            "REJECTION_REASON_REQUIRED",
          );
        }

        if (
          policy === "required_high_critical" &&
          (approval.priority === "high" || approval.priority === "critical")
        ) {
          throw new ApiError(
            400,
            "A rejection reason is required",
            "REJECTION_REASON_REQUIRED",
          );
        }
      }
    }

    // 5c. If assigned_approvers is set, enforce that only listed users (or their delegates) can decide
    const assignedApprovers: string[] | null = approval.assigned_approvers;
    let delegatedFrom: string | null = null;
    let delegationId: string | null = null;

    if (assignedApprovers && assignedApprovers.length > 0) {
      if (!assignedApprovers.includes(actorId)) {
        // Check if the actor is a delegate for any assigned approver
        const delegationResult = await findDelegationForDelegate(
          auth.orgId,
          actorId,
          assignedApprovers,
        );

        if (!delegationResult) {
          throw new ApiError(
            403,
            "You are not an assigned approver for this request",
            "NOT_ASSIGNED_APPROVER",
          );
        }

        delegatedFrom = delegationResult.delegatorId;
        delegationId = delegationResult.delegationId;
      }
    }

    // 5d. If required_role is set, enforce role hierarchy
    const requiredRole: string | null = approval.required_role;
    if (requiredRole) {
      const roleLevel: Record<string, number> = { member: 0, approver: 1, admin: 2, owner: 3 };
      const userRoleLevel = roleLevel[auth.membership.role] ?? 0;
      const requiredRoleLevel = roleLevel[requiredRole] ?? 0;

      if (userRoleLevel < requiredRoleLevel) {
        throw new ApiError(
          403,
          `This request requires approval from someone with the "${requiredRole}" role or higher`,
          "INSUFFICIENT_ROLE",
        );
      }
    }

    // 5e. If sequential, only the next-in-line approver can vote
    if (approval.is_sequential && assignedApprovers && assignedApprovers.length > 0) {
      const { data: priorVotes } = await admin
        .from("approval_votes")
        .select("user_id")
        .eq("request_id", id);

      const votedUserIds = new Set((priorVotes ?? []).map((v: { user_id: string }) => v.user_id));
      const nextApprover = assignedApprovers.find((uid: string) => !votedUserIds.has(uid));

      if (nextApprover && nextApprover !== actorId) {
        throw new ApiError(
          403,
          "It is not your turn to approve this request yet",
          "NOT_YOUR_TURN",
        );
      }
    }

    // 6. Determine if this is a multi-approver workflow
    const isMultiApprover = approval.required_approvals > 1;

    if (isMultiApprover) {
      // ---- Multi-approver flow ------------------------------------------------

      // 6a. Check for duplicate votes (UNIQUE constraint: request_id + user_id)
      const { data: existingVote } = await admin
        .from("approval_votes")
        .select("id")
        .eq("request_id", id)
        .eq("user_id", actorId)
        .maybeSingle();

      if (existingVote) {
        throw new ApiError(
          409,
          "You have already voted on this request",
          "DUPLICATE_VOTE",
        );
      }

      // 6b. Insert the vote
      const { error: voteError } = await admin
        .from("approval_votes")
        .insert({
          request_id: id,
          user_id: actorId,
          vote: validated.decision,
          comment: validated.comment ?? null,
          source: (validated.source as "dashboard" | "email" | "slack" | "push" | "api") ?? "dashboard",
        });

      if (voteError) {
        // Handle unique constraint violation gracefully
        if (voteError.code === "23505") {
          throw new ApiError(
            409,
            "You have already voted on this request",
            "DUPLICATE_VOTE",
          );
        }
        console.error("[Approvals] Vote insert failed:", voteError);
        throw new ApiError(500, "Failed to record vote");
      }

      // 6c. Determine final outcome
      const decidedAt = new Date().toISOString();
      const ipAddress = getIpAddress(request);
      let updated: typeof approval;

      if (validated.decision === "reject") {
        // Any rejection immediately rejects the entire request
        const { data: rejectedData, error: rejectError } = await admin
          .from("approval_requests")
          .update({
            status: "rejected",
            decided_by: actorId,
            decided_at: decidedAt,
            decision_comment: validated.comment ?? null,
            decision_source: validated.source ?? "dashboard",
            ...(delegatedFrom ? { delegated_from: delegatedFrom } : {}),
            ...(delegationId ? { delegation_id: delegationId } : {}),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (rejectError || !rejectedData) {
          console.error("[Approvals] Reject update failed:", rejectError);
          throw new ApiError(500, "Failed to update approval request");
        }

        updated = rejectedData;
      } else {
        // Approve vote: increment current_approvals
        const newCurrentApprovals = approval.current_approvals + 1;
        const thresholdMet = newCurrentApprovals >= approval.required_approvals;

        const updatePayload: Record<string, unknown> = {
          current_approvals: newCurrentApprovals,
        };

        if (thresholdMet) {
          updatePayload.status = "approved";
          updatePayload.decided_by = actorId;
          updatePayload.decided_at = decidedAt;
          updatePayload.decision_comment = validated.comment ?? null;
          updatePayload.decision_source = validated.source ?? "dashboard";
          if (delegatedFrom) {
            updatePayload.delegated_from = delegatedFrom;
            updatePayload.delegation_id = delegationId;
          }
          // Handle scheduled execution for multi-approver
          if (validated.scheduled_execution_at) {
            const scheduledTime = new Date(validated.scheduled_execution_at);
            if (scheduledTime <= new Date()) {
              throw new ApiError(
                400,
                "Scheduled execution time must be in the future",
                "INVALID_SCHEDULE_TIME",
              );
            }
            updatePayload.scheduled_execution_at = validated.scheduled_execution_at;
            updatePayload.execution_status = "scheduled";
          }
        }

        const { data: approvedData, error: approveError } = await admin
          .from("approval_requests")
          .update(updatePayload)
          .eq("id", id)
          .select("*")
          .single();

        if (approveError || !approvedData) {
          console.error("[Approvals] Approve update failed:", approveError);
          throw new ApiError(500, "Failed to update approval request");
        }

        updated = approvedData;
      }

      // 6d. Audit log for the vote
      logAuditEvent({
        orgId: auth.orgId,
        userId: actorId,
        action: `approval.vote.${validated.decision}`,
        resourceType: "approval_request",
        resourceId: id,
        details: {
          decision: validated.decision,
          comment: validated.comment ?? null,
          source: validated.source ?? "dashboard",
          current_approvals: updated.current_approvals,
          required_approvals: updated.required_approvals,
          final_status: updated.status,
          ...(delegatedFrom ? { delegated_from: delegatedFrom, delegation_id: delegationId } : {}),
          ...(geoIp ? { ip: geoIp } : {}),
          ...(geoCountry ? { country: geoCountry } : {}),
        },
        ipAddress,
      });

      // 6e. Update trust counters when a final decision is reached (fire-and-forget)
      if (updated.status !== "pending") {
        after(
          updateTrustCounter(
            auth.orgId,
            {
              action_type: approval.action_type,
              source: approval.source,
              title: approval.title,
              connection_id: approval.connection_id,
            },
            updated.status as "approved" | "rejected",
          )
        );
      }

      // 6f. Check conditions when approved (multi-approver)
      let multiConditionsBlocking = false;
      if (updated.status === "approved" && approval.conditions_met === false) {
        const condResult = await checkConditions(id);
        multiConditionsBlocking = !condResult.allMet;
      }

      // 6g. Callback delivery + notifications only when a final decision is reached
      if (updated.status !== "pending") {
        if (approval.callback_url && shouldDeliverCallback(updated) && !multiConditionsBlocking) {
          const decidedByName = await getUserDisplayName(admin, updated.decided_by);
          after(
            deliverCallback({
              requestId: id,
              connectionId: approval.connection_id,
              callbackUrl: approval.callback_url,
              callbackHeaders:
                (approval.callback_headers as Record<string, string>) ?? undefined,
              payload: {
                id: updated.id,
                status: updated.status,
                decided_by: updated.decided_by,
                decided_by_name: decidedByName,
                decided_at: updated.decided_at,
                decision_comment: updated.decision_comment,
                title: updated.title,
                priority: updated.priority,
                metadata: updated.metadata,
                execution_status: updated.execution_status,
              },
            })
          );
        }

        after(
          dispatchNotifications({
            type: updated.status === "approved" ? "approval.approved" : "approval.rejected",
            orgId: auth.orgId,
            requestId: id,
            requestTitle: updated.title,
            requestPriority: updated.priority,
            connectionId: approval.connection_id,
            decidedBy: actorId,
            decisionComment: validated.comment,
          })
        );
      }

      // 6g. Sequential chain: notify next approver if vote didn't finalize
      if (updated.status === "pending" && approval.is_sequential && assignedApprovers) {
        // Collect all user IDs that have voted (including current actor)
        const { data: allVotes } = await admin
          .from("approval_votes")
          .select("user_id")
          .eq("request_id", id);

        const votedSet = new Set((allVotes ?? []).map((v: { user_id: string }) => v.user_id));
        const nextApprover = assignedApprovers.find((uid: string) => !votedSet.has(uid));

        if (nextApprover) {
          after(
            dispatchNotifications({
              type: "approval.next_approver",
              orgId: auth.orgId,
              requestId: id,
              requestTitle: updated.title,
              requestPriority: updated.priority,
              connectionId: approval.connection_id ?? undefined,
              targetUserIds: [nextApprover],
            })
          );
        }
      }

      return NextResponse.json(updated);
    }

    // ---- Single-approver flow (default, required_approvals === 1) ----------

    // 6. Determine scheduled execution and conditions
    const decidedAt = new Date().toISOString();
    const newStatus = validated.decision === "approve" ? "approved" : "rejected";

    // Build update payload with optional scheduling fields
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      decided_by: actorId,
      decided_at: decidedAt,
      decision_comment: validated.comment ?? null,
      decision_source: validated.source ?? "dashboard",
      ...(delegatedFrom ? { delegated_from: delegatedFrom } : {}),
      ...(delegationId ? { delegation_id: delegationId } : {}),
    };

    // If approving with a scheduled execution time, set execution_status to scheduled
    if (validated.decision === "approve" && validated.scheduled_execution_at) {
      const scheduledTime = new Date(validated.scheduled_execution_at);
      if (scheduledTime <= new Date()) {
        throw new ApiError(
          400,
          "Scheduled execution time must be in the future",
          "INVALID_SCHEDULE_TIME",
        );
      }
      updatePayload.scheduled_execution_at = validated.scheduled_execution_at;
      updatePayload.execution_status = "scheduled";
    }

    const { data: updated, error: updateError } = await admin
      .from("approval_requests")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[Approvals] Update failed:", updateError);
      throw new ApiError(500, "Failed to update approval request");
    }

    // 6b. Check conditions for approved approvals
    let conditionsBlocking = false;
    if (newStatus === "approved" && approval.conditions_met === false) {
      const conditionResult = await checkConditions(id);
      conditionsBlocking = !conditionResult.allMet;
    }

    // 7. Audit log
    const ipAddress = getIpAddress(request);

    logAuditEvent({
      orgId: auth.orgId,
      userId: actorId,
      action: `approval.${newStatus}`,
      resourceType: "approval_request",
      resourceId: id,
      details: {
        decision: validated.decision,
        comment: validated.comment ?? null,
        source: validated.source ?? "dashboard",
        ...(delegatedFrom ? { delegated_from: delegatedFrom, delegation_id: delegationId } : {}),
        ...(validated.scheduled_execution_at ? { scheduled_execution_at: validated.scheduled_execution_at } : {}),
        ...(conditionsBlocking ? { conditions_blocking: true } : {}),
        ...(geoIp ? { ip: geoIp } : {}),
        ...(geoCountry ? { country: geoCountry } : {}),
      },
      ipAddress,
    });

    // 8. Update trust counters (fire-and-forget)
    after(
      updateTrustCounter(
        auth.orgId,
        {
          action_type: approval.action_type,
          source: approval.source,
          title: approval.title,
          connection_id: approval.connection_id,
        },
        newStatus as "approved" | "rejected",
      )
    );

    // 9. Callback delivery -- only if not scheduled and conditions are met
    if (approval.callback_url && shouldDeliverCallback(updated) && !conditionsBlocking) {
      const decidedByName = await getUserDisplayName(admin, actorId);
      after(
        deliverCallback({
          requestId: id,
          connectionId: approval.connection_id,
          callbackUrl: approval.callback_url,
          callbackHeaders:
            (approval.callback_headers as Record<string, string>) ?? undefined,
          payload: {
            id: updated.id,
            status: updated.status,
            decided_by: updated.decided_by,
            decided_by_name: decidedByName,
            decided_at: updated.decided_at,
            decision_comment: updated.decision_comment,
            title: updated.title,
            priority: updated.priority,
            metadata: updated.metadata,
            execution_status: updated.execution_status,
          },
        })
      );
    }

    // 10. Dispatch notifications
    after(
      dispatchNotifications({
        type: newStatus === "approved" ? "approval.approved" : "approval.rejected",
        orgId: auth.orgId,
        requestId: id,
        requestTitle: updated.title,
        requestPriority: updated.priority,
        connectionId: approval.connection_id,
        decidedBy: actorId,
        decisionComment: validated.comment,
      })
    );

    return NextResponse.json(updated);
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

// ---- DELETE /api/v1/approvals/[id] ----------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can cancel approvals",
        "SESSION_REQUIRED",
      );
    }

    const deleteActorId = auth.user.id;
    const admin = createAdminClient();

    // 2. Fetch approval
    const approval = await fetchApproval(admin, id, auth.orgId);

    // 3. Check status is pending, OR allow cancelling a scheduled execution
    const isScheduledExecution =
      approval.status === "approved" &&
      approval.execution_status === "scheduled";

    if (approval.status !== "pending" && !isScheduledExecution) {
      throw new ApiError(
        409,
        "Approval is not pending",
        "NOT_PENDING",
      );
    }

    // 4. Update status to cancelled (or cancel scheduled execution)
    const cancelPayload: Record<string, unknown> = isScheduledExecution
      ? { execution_status: "cancelled" }
      : { status: "cancelled" };

    const { data: updated, error: updateError } = await admin
      .from("approval_requests")
      .update(cancelPayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[Approvals] Cancel failed:", updateError);
      throw new ApiError(500, "Failed to cancel approval request");
    }

    // 5. Audit log
    const ipAddress = getIpAddress(request);

    logAuditEvent({
      orgId: auth.orgId,
      userId: deleteActorId,
      action: isScheduledExecution ? "approval.execution_cancelled" : "approval.cancelled",
      resourceType: "approval_request",
      resourceId: id,
      details: isScheduledExecution
        ? { scheduled_execution_at: approval.scheduled_execution_at }
        : undefined,
      ipAddress,
    });

    // 6. Callback delivery -- only for full cancellation, not scheduled execution cancellation
    if (!isScheduledExecution && approval.callback_url) {
      after(
        deliverCallback({
          requestId: id,
          connectionId: approval.connection_id,
          callbackUrl: approval.callback_url,
          callbackHeaders:
            (approval.callback_headers as Record<string, string>) ?? undefined,
          payload: {
            id: updated.id,
            status: updated.status,
            decided_by: null,
            decided_at: null,
            decision_comment: null,
            title: updated.title,
            priority: updated.priority,
            metadata: updated.metadata,
          },
        })
      );
    }

    // 7. Dispatch notifications
    after(
      dispatchNotifications({
        type: isScheduledExecution ? "approval.execution_cancelled" : "approval.cancelled",
        orgId: auth.orgId,
        requestId: id,
        requestTitle: updated.title,
        requestPriority: updated.priority,
        connectionId: approval.connection_id,
        decidedBy: deleteActorId,
      })
    );

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
