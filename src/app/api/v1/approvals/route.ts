// ---------------------------------------------------------------------------
// OKRunit -- Approvals API: POST (create) + GET (list with filters)
// ---------------------------------------------------------------------------

import { NextResponse, after } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import {
  createApprovalSchema,
  paginationSchema,
} from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, addRateLimitHeaders, type RateLimitResult } from "@/lib/api/rate-limiter";
import { enforceConnectionScoping } from "@/lib/api/connection-scoping";
import { checkForAnomalies } from "@/lib/api/anomaly-detection";
import { evaluateRules, type RuleEvaluationResult } from "@/lib/api/rules-engine";
import { calculateRiskScore } from "@/lib/api/risk-scoring";
import { resolveDelegates } from "@/lib/api/delegation";
import { checkTrustThreshold } from "@/lib/api/trust-engine";
import { dispatchNotifications } from "@/lib/notifications/orchestrator";
import { calculateSlaDeadline, checkSlaBreach, type SlaConfig } from "@/lib/api/sla";
import { checkBottleneckThreshold } from "@/lib/api/bottleneck";
import { enforceFourEyesOnCreation } from "@/lib/api/four-eyes";
import { canCreateRequest } from "@/lib/billing/enforce";

// ---- Helpers ---------------------------------------------------------------

/** Return all roles that satisfy a minimum role requirement. */
function getRoleHierarchy(minRole: string): string[] {
  switch (minRole) {
    case "member": return ["member", "approver", "admin", "owner"];
    case "approver": return ["approver", "admin", "owner"];
    case "admin": return ["admin", "owner"];
    case "owner": return ["owner"];
    default: return [minRole];
  }
}

// ---- POST /api/v1/approvals -----------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate -- API key or OAuth (for integrations like Zapier)
    const auth = await authenticateRequest(request);

    if (auth.type === "session") {
      throw new ApiError(
        403,
        "Session authentication is not allowed for creating approvals. Use an API key or OAuth.",
        "API_KEY_OR_OAUTH_REQUIRED",
      );
    }

    // 2. Emergency stop check
    const admin = createAdminClient();

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("emergency_stop_active, default_auto_action, default_auto_action_minutes, sla_config, four_eyes_config")
      .eq("id", auth.orgId)
      .single();

    if (orgError || !org) {
      throw new ApiError(500, "Failed to fetch organization");
    }

    if (org.emergency_stop_active) {
      throw new ApiError(
        503,
        "Emergency stop is active",
        "EMERGENCY_STOP",
      );
    }

    // 2b. Billing plan enforcement
    const billingCheck = await canCreateRequest(auth.orgId);
    if (!billingCheck.allowed) {
      return NextResponse.json(
        {
          error: billingCheck.reason,
          code: "PLAN_LIMIT_EXCEEDED",
          upgrade_required: true,
          limit: billingCheck.limit,
          current: billingCheck.current,
          plan: billingCheck.plan,
        },
        { status: 403 },
      );
    }

    // 3. Extract connection info (API key auth has connection; OAuth does not)
    const connectionId = auth.type === "api_key" ? auth.connection.id : null;
    const connectionName = auth.type === "api_key" ? auth.connection.name : null;

    // 4. Rate limit check
    let rateResult: RateLimitResult | null = null;
    if (auth.type === "api_key") {
      // API key connections: per-connection sliding window
      rateResult = await checkRateLimit(
        auth.connection.id,
        auth.connection.rate_limit_per_hour,
      );

      if (!rateResult.allowed) {
        const response = NextResponse.json(
          { error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" },
          { status: 429 },
        );
        addRateLimitHeaders(response, rateResult);
        return response;
      }
    } else {
      // OAuth/session: per-org IP-based rate limit (100/min)
      const { checkIpRateLimit, getClientIp, API_RATE_LIMIT, rateLimitResponse: rlResponse } = await import("@/lib/api/ip-rate-limiter");
      const ip = getClientIp(request);
      const rl = checkIpRateLimit(`approval-create:${auth.orgId}:${ip}`, API_RATE_LIMIT);
      if (!rl.allowed) return rlResponse(rl);
    }

    // 5. Validate request body
    const body = await request.json();
    const validated = createApprovalSchema.parse(body);

    // 5b. Auto-detect source from OAuth client name when not explicitly provided
    let autoDetectedSource: string | null = null;
    let oauthClientName: string | null = null;
    if (auth.type === "oauth") {
      const { data: oauthClient } = await admin
        .from("oauth_clients")
        .select("name")
        .eq("client_id", auth.clientId)
        .single();

      oauthClientName = oauthClient?.name ?? null;

      if (oauthClientName && !validated.source) {
        const clientNameLower = oauthClientName.toLowerCase();
        if (clientNameLower.includes("zapier")) autoDetectedSource = "zapier";
        else if (clientNameLower.includes("make")) autoDetectedSource = "make";
        else if (clientNameLower.includes("n8n")) autoDetectedSource = "n8n";
        else if (clientNameLower.includes("windmill")) autoDetectedSource = "windmill";
        else if (clientNameLower.includes("monday")) autoDetectedSource = "monday";
      }
    }

    // 5c. Build created_by info
    let createdBy: Record<string, unknown> | null = null;
    if (auth.type === "api_key") {
      createdBy = {
        type: "api_key",
        connection_id: auth.connection.id,
        connection_name: auth.connection.name,
        user_id: auth.connection.created_by,
      };
    } else if (auth.type === "oauth") {
      createdBy = {
        type: "oauth",
        client_id: auth.clientId,
        client_name: oauthClientName,
        user_id: auth.userId,
      };
    }

    // 6. Connection scoping enforcement (API key auth only)
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (auth.type === "api_key") {
      enforceConnectionScoping(auth.connection, {
        actionType: validated.action_type,
        priority: validated.priority,
        ipAddress,
      });
    }

    // 7. Approval flow lookup: if source + source_id provided, find or create
    //    the matching flow and apply its saved defaults.
    let flowId: string | null = null;
    let flowPriority: string | undefined;
    let flowExpiresAt: string | undefined;
    let flowRequiredApprovals: number | undefined;
    let flowActionType: string | undefined;
    let flowAssignedTeamId: string | undefined;
    let flowAssignedApprovers: string[] | undefined;
    let flowApproverMode: string | undefined;
    let flowRequiredRole: string | undefined;
    let flowIsSequential: boolean | undefined;

    if (validated.source && validated.source_id) {
      const { data: existingFlow } = await admin
        .from("approval_flows")
        .select("*")
        .eq("org_id", auth.orgId)
        .eq("source", validated.source)
        .eq("source_id", validated.source_id)
        .maybeSingle();

      if (existingFlow) {
        flowId = existingFlow.id;

        // Apply configured defaults (only if the flow has been customized
        // and apply_for_next has not been exhausted)
        const flowStillActive =
          existingFlow.is_configured &&
          (existingFlow.apply_for_next === null || existingFlow.apply_for_next > 0);

        if (flowStillActive) {
          flowPriority = existingFlow.default_priority ?? undefined;
          flowActionType = existingFlow.default_action_type ?? undefined;
          flowAssignedTeamId = existingFlow.assigned_team_id ?? undefined;
          flowAssignedApprovers = existingFlow.assigned_approvers ?? undefined;
          flowRequiredApprovals = existingFlow.default_required_approvals ?? undefined;
          flowApproverMode = existingFlow.approver_mode ?? undefined;
          flowRequiredRole = existingFlow.required_role ?? undefined;
          flowIsSequential = existingFlow.is_sequential ?? undefined;

          if (existingFlow.default_expiration_hours) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + existingFlow.default_expiration_hours);
            flowExpiresAt = expiresAt.toISOString();
          }
        }

        // Fire-and-forget: bump request_count, last_request_at, and
        // decrement apply_for_next when it is a positive integer.
        // Also update name if source_name is provided and better than auto-generated
        const flowUpdate: Record<string, unknown> = {
          request_count: existingFlow.request_count + 1,
          last_request_at: new Date().toISOString(),
        };

        if (validated.source_name && existingFlow.name !== validated.source_name) {
          flowUpdate.name = validated.source_name;
        }
        if (validated.source_url && existingFlow.source_url !== validated.source_url) {
          flowUpdate.source_url = validated.source_url;
        }

        if (flowStillActive && typeof existingFlow.apply_for_next === "number" && existingFlow.apply_for_next > 0) {
          flowUpdate.apply_for_next = existingFlow.apply_for_next - 1;
        }

        admin
          .from("approval_flows")
          .update(flowUpdate)
          .eq("id", existingFlow.id)
          .then();
      } else {
        // Auto-create a new unconfigured flow
        const { data: newFlow } = await admin
          .from("approval_flows")
          .insert({
            org_id: auth.orgId,
            source: validated.source,
            source_id: validated.source_id,
            name: validated.source_name || `${validated.source} flow ${validated.source_id}`,
            source_url: validated.source_url ?? null,
            is_configured: false,
            request_count: 1,
            last_request_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (newFlow) {
          flowId = newFlow.id;
        }
      }
    }

    // 8. Merge flow defaults with request values (request values take precedence)
    const effectivePriority = validated.priority ?? flowPriority ?? "medium";
    const effectiveActionType = validated.action_type ?? flowActionType ?? null;
    const effectiveExpiresAt = validated.expires_at ?? flowExpiresAt ?? null;

    // 9. Anomaly detection
    const anomaly = await checkForAnomalies({
      orgId: auth.orgId,
      connectionId: connectionId ?? undefined,
      priority: effectivePriority,
    });

    if (anomaly.isAnomaly) {
      console.warn(`[Approvals] Anomaly detected: ${anomaly.reason}`);
      logAuditEvent({
        orgId: auth.orgId,
        connectionId: connectionId ?? undefined,
        action: "anomaly.detected",
        resourceType: "approval_request",
        details: { reason: anomaly.reason, shouldEmergencyStop: anomaly.shouldEmergencyStop },
        ipAddress,
      });

      if (anomaly.shouldEmergencyStop) {
        await admin
          .from("organizations")
          .update({
            emergency_stop_active: true,
            emergency_stop_activated_at: new Date().toISOString(),
          })
          .eq("id", auth.orgId);

        throw new ApiError(
          503,
          `Emergency stop auto-activated: ${anomaly.reason}`,
          "EMERGENCY_STOP_AUTO",
        );
      }
    }

    // 10. Idempotency check
    if (validated.idempotency_key) {
      let idempotencyQuery = admin
        .from("approval_requests")
        .select("*")
        .eq("org_id", auth.orgId)
        .eq("idempotency_key", validated.idempotency_key);

      if (connectionId) {
        idempotencyQuery = idempotencyQuery.eq("connection_id", connectionId);
      }

      const { data: existing } = await idempotencyQuery.maybeSingle();

      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    // 10b. Check if any org member has paused auto-approvals
    const { count: pausedCount } = await admin
      .from("org_memberships")
      .select("*", { count: "exact", head: true })
      .eq("org_id", auth.orgId)
      .eq("auto_approvals_paused", true);

    const autoApprovalsPaused = (pausedCount ?? 0) > 0;

    // 11. Auto-approve rules check (skipped if any member paused auto-approvals)
    const ruleResult: RuleEvaluationResult = autoApprovalsPaused
      ? { matched: false }
      : await evaluateRules({
          orgId: auth.orgId,
          connectionId: connectionId ?? undefined,
          actionType: effectiveActionType ?? undefined,
          priority: effectivePriority,
          title: validated.title,
          metadata: validated.metadata as Record<string, unknown> | undefined,
        });

    // 11b. Trust threshold check (auto-approve after N consecutive approvals)
    let trustResult: { autoApprove: boolean; reason: string; counterId: string | null } | null = null;
    if (!autoApprovalsPaused && (!ruleResult.matched || ruleResult.action !== "auto_approve")) {
      trustResult = await checkTrustThreshold(auth.orgId, {
        action_type: effectiveActionType,
        source: validated.source ?? autoDetectedSource,
        title: validated.title,
        connection_id: connectionId,
      });
    }

    // 12. Determine approvers: flow defaults → request values → rule routing
    let assignedApprovers: string[] | null = validated.assigned_approvers ?? flowAssignedApprovers ?? null;
    let requiredApprovals = assignedApprovers
      ? assignedApprovers.length
      : (validated.required_approvals ?? flowRequiredApprovals ?? 1);

    let assignedTeamId: string | null = validated.assigned_team_id ?? flowAssignedTeamId ?? null;

    // 12b. Routing rules fallback
    if (!assignedApprovers && !assignedTeamId && ruleResult.matched && ruleResult.action === "route" && ruleResult.actionConfig) {
      const routeConfig = ruleResult.actionConfig as { team_id?: string; user_ids?: string[]; required_role?: string; is_sequential?: boolean };
      if (routeConfig.team_id) {
        assignedTeamId = routeConfig.team_id;
      } else if (routeConfig.user_ids && routeConfig.user_ids.length > 0) {
        assignedApprovers = routeConfig.user_ids;
        requiredApprovals = assignedApprovers.length;
      }
      if (routeConfig.required_role) {
        flowRequiredRole = routeConfig.required_role;
      }
      if (routeConfig.is_sequential !== undefined) {
        flowIsSequential = routeConfig.is_sequential;
      }
    }

    // Handle team assignment: resolve team members with can_approve = true
    if (assignedTeamId && !assignedApprovers) {
      const { data: teamMemberships } = await admin
        .from("team_memberships")
        .select("user_id")
        .eq("team_id", assignedTeamId);

      if (teamMemberships && teamMemberships.length > 0) {
        const teamUserIds = teamMemberships.map(m => m.user_id);

        const { data: approverMemberships } = await admin
          .from("org_memberships")
          .select("user_id")
          .eq("org_id", auth.orgId)
          .eq("can_approve", true)
          .in("user_id", teamUserIds);

        if (approverMemberships && approverMemberships.length > 0) {
          assignedApprovers = approverMemberships.map(m => m.user_id);
          requiredApprovals = assignedApprovers.length;
        }
      }
    }

    // 12d. Role-based approver resolution
    const effectiveRequiredRole: string | null = flowRequiredRole ?? null;
    const effectiveIsSequential: boolean = validated.is_sequential ?? flowIsSequential ?? false;

    if (flowApproverMode === "role_based" && effectiveRequiredRole && !assignedApprovers) {
      const roleHierarchy = getRoleHierarchy(effectiveRequiredRole);
      const { data: roleMemberships } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", auth.orgId)
        .eq("can_approve", true)
        .in("role", roleHierarchy);

      if (roleMemberships && roleMemberships.length > 0) {
        assignedApprovers = roleMemberships.map(m => m.user_id);
        requiredApprovals = 1; // Any one of them can approve
      }
    }

    // 12e. Risk scoring
    const riskResult = await calculateRiskScore(
      {
        priority: effectivePriority,
        action_type: effectiveActionType,
        description: validated.description,
        callback_url: validated.callback_url,
        source: validated.source ?? autoDetectedSource,
      },
      auth.orgId,
    );

    // Auto-escalate: if risk is critical and only 1 approver required, bump to 2
    if (riskResult.level === "critical" && requiredApprovals === 1) {
      requiredApprovals = 2;
    }

    // 12f1. Four-eyes principle: bump required_approvals if applicable
    requiredApprovals = enforceFourEyesOnCreation(org, {
      action_type: effectiveActionType ?? "",
      priority: effectivePriority as "low" | "medium" | "high" | "critical",
      required_approvals: requiredApprovals,
    });

    // 12f. Resolve delegations for assigned approvers (expand notification targets)
    let delegateMap: Map<string, string> = new Map();
    if (assignedApprovers && assignedApprovers.length > 0) {
      delegateMap = await resolveDelegates(auth.orgId, assignedApprovers);
    }

    // 13. Insert approval request
    const isRuleAutoApproved = ruleResult.matched && ruleResult.action === "auto_approve";
    const isTrustAutoApproved = !isRuleAutoApproved && (trustResult?.autoApprove ?? false);
    const isAutoApproved = isRuleAutoApproved || isTrustAutoApproved;

    // 13b. Compute auto-action deadline (time-based auto-approve/reject)
    //       Request values take precedence, then org defaults.
    //       Skipped when auto-approvals are paused by any org member.
    const effectiveAutoAction = autoApprovalsPaused ? null : (validated.auto_action ?? org.default_auto_action ?? null);
    const effectiveAutoMinutes = autoApprovalsPaused ? null : (validated.auto_action_after_minutes ?? org.default_auto_action_minutes ?? null);

    let autoActionDeadline: string | null = null;
    if (!isAutoApproved && effectiveAutoAction && effectiveAutoMinutes) {
      const deadline = new Date();
      deadline.setMinutes(deadline.getMinutes() + effectiveAutoMinutes);
      autoActionDeadline = deadline.toISOString();
    }

    // 13c. Calculate SLA deadline from org config
    const slaDeadline = isAutoApproved
      ? null
      : calculateSlaDeadline(
          effectivePriority as "low" | "medium" | "high" | "critical",
          (org.sla_config as SlaConfig) ?? null,
        );

    const { data: approval, error: insertError } = await admin
      .from("approval_requests")
      .insert({
        org_id: auth.orgId,
        connection_id: connectionId,
        flow_id: flowId,
        source: validated.source ?? autoDetectedSource,
        title: validated.title,
        description: validated.description ?? null,
        action_type: effectiveActionType,
        priority: effectivePriority,
        status: isAutoApproved ? "approved" : "pending",
        callback_url: validated.callback_url ?? null,
        callback_headers: validated.callback_headers ?? null,
        metadata: validated.metadata ?? null,
        context_html: validated.context_html ?? null,
        expires_at: effectiveExpiresAt,
        idempotency_key: validated.idempotency_key ?? null,
        required_approvals: requiredApprovals,
        assigned_approvers: assignedApprovers,
        assigned_team_id: assignedTeamId,
        created_by: createdBy,
        required_role: effectiveRequiredRole,
        is_sequential: effectiveIsSequential,
        risk_score: riskResult.score,
        risk_level: riskResult.level,
        risk_factors: riskResult.factors,
        auto_approved: isAutoApproved,
        decision_source: isAutoApproved ? "auto_rule" : null,
        decided_at: isAutoApproved ? new Date().toISOString() : null,
        auto_action: effectiveAutoAction,
        auto_action_after_minutes: effectiveAutoMinutes,
        auto_action_deadline: autoActionDeadline,
        require_rejection_reason: validated.require_rejection_reason ?? false,
        conditions_met: validated.conditions && validated.conditions.length > 0 ? false : true,
        sla_deadline: slaDeadline,
        notify_channel_ids: validated.notify_channel_ids ?? null,
      })
      .select("*")
      .single();

    if (insertError || !approval) {
      console.error("[Approvals] Insert failed:", insertError);
      throw new ApiError(500, "Failed to create approval request");
    }

    // 13c. Insert condition records if provided
    if (validated.conditions && validated.conditions.length > 0) {
      const conditionRecords = validated.conditions.map((c) => ({
        request_id: approval.id,
        name: c.name,
        description: c.description ?? null,
        check_type: c.check_type,
        webhook_url: c.webhook_url ?? null,
      }));

      const { error: condInsertError } = await admin
        .from("approval_conditions")
        .insert(conditionRecords);

      if (condInsertError) {
        console.error("[Approvals] Condition insert failed:", condInsertError);
        // Non-fatal: approval was created, conditions just failed to insert
      }
    }

    // 14. Audit log
    logAuditEvent({
      orgId: auth.orgId,
      connectionId: connectionId ?? undefined,
      action: isAutoApproved ? "approval.auto_approved" : "approval.created",
      resourceType: "approval_request",
      resourceId: approval.id,
      details: {
        title: validated.title,
        priority: effectivePriority,
        ...(flowId ? { flow_id: flowId } : {}),
        ...(validated.source ? { source: validated.source } : {}),
        ...(ruleResult.rule ? { rule_id: ruleResult.rule.id, rule_name: ruleResult.rule.name } : {}),
        ...(isTrustAutoApproved && trustResult ? { trust_counter_id: trustResult.counterId, trust_reason: trustResult.reason } : {}),
        ...(autoActionDeadline ? { auto_action: effectiveAutoAction, auto_action_deadline: autoActionDeadline } : {}),
        risk_score: riskResult.score,
        risk_level: riskResult.level,
      },
      ipAddress,
    });

    // 15. Dispatch notifications (fire-and-forget)
    //     Include delegates alongside original approvers
    let targetUserIds: string[] | undefined;
    if (assignedApprovers && assignedApprovers.length > 0) {
      if (effectiveIsSequential) {
        // Sequential chain: only notify the first approver (and their delegate)
        const firstApprover = assignedApprovers[0];
        const firstDelegate = delegateMap.get(firstApprover);
        targetUserIds = firstDelegate
          ? [firstApprover, firstDelegate]
          : [firstApprover];
      } else {
        // Notify all assigned approvers + their delegates
        const allTargets = new Set(assignedApprovers);
        for (const [, delegateId] of delegateMap) {
          allTargets.add(delegateId);
        }
        targetUserIds = Array.from(allTargets);
      }
    }

    after(async () => {
      await dispatchNotifications({
        type: isAutoApproved ? "approval.approved" : "approval.created",
        orgId: auth.orgId,
        requestId: approval.id,
        requestTitle: validated.title,
        requestDescription: validated.description,
        requestPriority: effectivePriority,
        connectionId: connectionId ?? undefined,
        connectionName: connectionName ?? undefined,
        targetUserIds,
        notifyChannelIds: validated.notify_channel_ids,
        source: validated.source ?? autoDetectedSource ?? undefined,
        actionType: effectiveActionType ?? undefined,
        assignedApprovers: assignedApprovers ?? undefined,
        assignedTeamId: assignedTeamId ?? undefined,
      });
    });

    // 15b. Bottleneck detection (fire-and-forget)
    //      Check if any assigned approver now exceeds the threshold
    if (!isAutoApproved && assignedApprovers && assignedApprovers.length > 0) {
      after(async () => {
        try {
          const overloadedUserIds = await checkBottleneckThreshold(auth.orgId, assignedApprovers);
          if (overloadedUserIds.length > 0) {
            await dispatchNotifications({
              type: "approval.bottleneck",
              orgId: auth.orgId,
              requestId: approval.id,
              requestTitle: `Bottleneck: ${overloadedUserIds.length} approver(s) overloaded`,
              requestPriority: "high",
            });
          }
        } catch (err) {
          console.error("[Approvals] Bottleneck check failed:", err);
        }
      });
    }

    // 16. Return created approval (with rate limit headers if applicable)
    const response = NextResponse.json(approval, { status: 201 });
    if (rateResult) {
      addRateLimitHeaders(response, rateResult);
    }
    return response;
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

// ---- GET /api/v1/approvals ------------------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate (both API key and session supported)
    const auth = await authenticateRequest(request);

    // 2. Parse query params
    const { searchParams } = new URL(request.url);
    const queryInput = {
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : undefined,
      page_size: searchParams.get("page_size")
        ? Number(searchParams.get("page_size"))
        : undefined,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    };

    const params = paginationSchema.parse(queryInput);
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;

    const admin = createAdminClient();

    // 3. Build query filtered by org_id
    let query = admin
      .from("approval_requests")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    // 4. Apply filters
    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.priority) {
      query = query.eq("priority", params.priority);
    }

    if (params.search) {
      query = query.textSearch("search_vector", params.search, {
        type: "websearch",
      });
    }

    // 5. Paginate
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: approvals, error: queryError } = await query;

    if (queryError) {
      console.error("[Approvals] Query failed:", queryError);
      throw new ApiError(500, "Failed to fetch approval requests");
    }

    // 6. Count query for total
    let countQuery = admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", auth.orgId);

    if (params.status) {
      countQuery = countQuery.eq("status", params.status);
    }

    if (params.priority) {
      countQuery = countQuery.eq("priority", params.priority);
    }

    if (params.search) {
      countQuery = countQuery.textSearch("search_vector", params.search, {
        type: "websearch",
      });
    }

    const { count } = await countQuery;

    // 7. Lazy expiration + auto-action deadline check
    const now = new Date().toISOString();
    const expiredIds: string[] = [];
    const autoActionIds: { id: string; action: string }[] = [];

    const activeApprovals = (approvals ?? []).filter((approval) => {
      if (approval.status !== "pending") return true;

      // Check regular expiration first
      if (approval.expires_at && approval.expires_at < now) {
        expiredIds.push(approval.id);
        return false;
      }

      // Check auto-action deadline (time-based auto-approve/reject)
      if (
        approval.auto_action &&
        approval.auto_action_deadline &&
        approval.auto_action_deadline < now
      ) {
        autoActionIds.push({ id: approval.id, action: approval.auto_action as string });
        // Mutate in-place for the response so the client sees the final state
        approval.status = approval.auto_action === "approve" ? "approved" : "rejected";
        approval.decided_at = now;
        approval.decision_source = "auto_rule";
        approval.auto_approved = approval.auto_action === "approve";
      }

      return true;
    });

    if (expiredIds.length > 0) {
      admin
        .from("approval_requests")
        .update({ status: "expired" })
        .in("id", expiredIds)
        .then();
    }

    // Fire-and-forget: lazy SLA breach check for pending approvals
    const slaBreachIds: string[] = [];
    for (const approval of activeApprovals) {
      if (checkSlaBreach(approval)) {
        slaBreachIds.push(approval.id);
        approval.sla_breached = true;
        approval.sla_breached_at = now;
      }
    }

    if (slaBreachIds.length > 0) {
      admin
        .from("approval_requests")
        .update({
          sla_breached: true,
          sla_breached_at: now,
        })
        .in("id", slaBreachIds)
        .eq("sla_breached", false)
        .then();

      // Dispatch SLA breach notifications for each breached approval
      after(async () => {
        for (const breachedApproval of activeApprovals.filter((a) => slaBreachIds.includes(a.id))) {
          await dispatchNotifications({
            type: "approval.sla_breached",
            orgId: auth.orgId,
            requestId: breachedApproval.id,
            requestTitle: breachedApproval.title,
            requestPriority: breachedApproval.priority,
            connectionId: breachedApproval.connection_id ?? undefined,
          });
        }
      });
    }

    // Fire-and-forget: apply auto-actions for approvals past their deadline
    for (const { id: autoId, action: autoAct } of autoActionIds) {
      const newStatus = autoAct === "approve" ? "approved" : "rejected";
      admin
        .from("approval_requests")
        .update({
          status: newStatus,
          decided_at: now,
          decision_source: "auto_rule",
          auto_approved: autoAct === "approve",
        })
        .eq("id", autoId)
        .eq("status", "pending") // guard against races
        .then();

      // Audit the auto-action
      logAuditEvent({
        orgId: auth.orgId,
        action: `approval.auto_${newStatus}`,
        resourceType: "approval_request",
        resourceId: autoId,
        details: { reason: "auto_action_deadline_reached", auto_action: autoAct },
      });

      // Deliver callback for auto-actioned approvals
      const autoApproval = activeApprovals.find(a => a.id === autoId);
      if (autoApproval?.callback_url) {
        // Dynamic import to avoid circular dependency issues at module load
        import("@/lib/api/callbacks").then(({ deliverCallback }) => {
          deliverCallback({
            requestId: autoId,
            connectionId: autoApproval.connection_id,
            callbackUrl: autoApproval.callback_url,
            callbackHeaders: (autoApproval.callback_headers as Record<string, string>) ?? undefined,
            payload: {
              id: autoApproval.id,
              status: newStatus,
              decided_by: null,
              decided_at: now,
              decision_comment: null,
              title: autoApproval.title,
              priority: autoApproval.priority,
              metadata: autoApproval.metadata,
            },
          });
        });
      }
    }

    // 8. Enrich with decided_by_name for decided approvals
    const decidedByIds = [
      ...new Set(
        activeApprovals
          .map((a) => a.decided_by)
          .filter((id): id is string => !!id),
      ),
    ];

    let nameMap: Map<string, string> = new Map();
    if (decidedByIds.length > 0) {
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", decidedByIds);

      nameMap = new Map(
        (profiles ?? []).map((p: { id: string; full_name: string | null; email: string }) => [
          p.id,
          p.full_name || p.email,
        ]),
      );
    }

    const enrichedApprovals = activeApprovals.map((a) => ({
      ...a,
      decided_by_name: a.decided_by ? (nameMap.get(a.decided_by) ?? null) : null,
    }));

    return NextResponse.json({
      data: enrichedApprovals,
      total: (count ?? 0) - expiredIds.length,
      page,
      page_size: pageSize,
    });
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
