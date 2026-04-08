// ---------------------------------------------------------------------------
// OKrunit -- Approvals API: POST (create) + GET (list with filters)
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
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, addRateLimitHeaders, type RateLimitResult } from "@/lib/api/rate-limiter";
import { enforceConnectionScoping } from "@/lib/api/connection-scoping";
import { checkForAnomalies } from "@/lib/api/anomaly-detection";
import { evaluateRules, type RuleEvaluationResult } from "@/lib/api/rules-engine";
import { calculateRiskScore } from "@/lib/api/risk-scoring";
import { resolveDelegates } from "@/lib/api/delegation";
import { checkTrustThreshold } from "@/lib/api/trust-engine";
import { dispatchNotifications } from "@/lib/notifications/orchestrator";
import { createInAppNotification, createInAppNotificationBulk } from "@/lib/notifications/in-app";
import { calculateSlaDeadline, checkSlaBreach, type SlaConfig } from "@/lib/api/sla";
import { calculateNextEscalation } from "@/lib/api/escalation";
import type { EscalationConfig } from "@/lib/types/database";
import { checkBottleneckThreshold } from "@/lib/api/bottleneck";
import { enforceFourEyesOnCreation } from "@/lib/api/four-eyes";
import { canCreateRequest } from "@/lib/billing/enforce";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

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
      .select("emergency_stop_active, default_auto_action, default_auto_action_minutes, sla_config, four_eyes_config, escalation_config")
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

    // 5. Validate request body (support both JSON and form-urlencoded)
    let body: unknown;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
      // Parse stringified JSON values that Make.com may send as form fields
      body = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => {
          try { return [k, JSON.parse(v)]; } catch { return [k, v]; }
        }),
      );
    } else {
      body = await request.json();
    }

    // Strip empty strings, "undefined", and null values so optional Zod fields
    // pass validation. Integration platforms (Make, Zapier) often send empty
    // strings for unfilled optional fields, which breaks z.url() etc.
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const cleaned = body as Record<string, unknown>;
      for (const key of Object.keys(cleaned)) {
        if (cleaned[key] === "" || cleaned[key] === null || cleaned[key] === "undefined") {
          delete cleaned[key];
        }
      }
      // Parse metadata if it arrives as a JSON string
      if (typeof cleaned.metadata === "string") {
        try { cleaned.metadata = JSON.parse(cleaned.metadata); } catch { delete cleaned.metadata; }
      }
    }

    const validated = createApprovalSchema.parse(body);

    // 5a. Apply template defaults (if template_id is provided)
    if (validated.template_id) {
      const { data: template } = await admin
        .from("approval_templates")
        .select("*")
        .eq("id", validated.template_id)
        .eq("org_id", auth.orgId)
        .eq("is_active", true)
        .single();

      if (template) {
        // Apply template defaults for fields not explicitly provided in the request
        if (!validated.action_type && template.action_type) validated.action_type = template.action_type;
        if (!validated.priority && template.default_priority) validated.priority = template.default_priority as "low" | "medium" | "high" | "critical";
        if (!validated.assigned_approvers && template.assigned_approvers?.length) validated.assigned_approvers = template.assigned_approvers;
        if (!validated.callback_url && template.callback_url_pattern) validated.callback_url = template.callback_url_pattern;

        // Apply title pattern with metadata substitution: "Deploy {service} to {env}"
        if (template.title_pattern && validated.title === template.title_pattern) {
          // Title matches pattern exactly, try to fill placeholders from metadata
          if (validated.metadata) {
            let filledTitle = template.title_pattern;
            for (const [key, value] of Object.entries(validated.metadata)) {
              if (typeof value === "string") {
                filledTitle = filledTitle.replace(`{${key}}`, value);
              }
            }
            validated.title = filledTitle;
          }
        }
      }
    }

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
    let flowIsUnconfigured = false;
    let flowIsNewlyCreated = false;
    let flowPriority: string | undefined;
    let flowExpiresAt: string | undefined;
    let flowRequiredApprovals: number | undefined;
    let flowActionType: string | undefined;
    let flowAssignedTeamId: string | undefined;
    let flowAssignedPositionId: string | undefined;
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
        flowIsUnconfigured = !existingFlow.is_configured;

        // Apply configured defaults (only if the flow has been customized
        // and apply_for_next has not been exhausted)
        const flowStillActive =
          existingFlow.is_configured &&
          (existingFlow.apply_for_next === null || existingFlow.apply_for_next > 0);

        if (flowStillActive) {
          flowPriority = existingFlow.default_priority ?? undefined;
          flowActionType = existingFlow.default_action_type ?? undefined;
          flowAssignedTeamId = existingFlow.assigned_team_id ?? undefined;
          flowAssignedPositionId = existingFlow.assigned_position_id ?? undefined;
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
          ;
      } else {
        // Auto-create a new unconfigured flow
        const { data: newFlow } = await admin
          .from("approval_flows")
          .insert({
            org_id: auth.orgId,
            source: validated.source,
            source_id: validated.source_id,
            name: validated.source_name || `${validated.source.charAt(0).toUpperCase() + validated.source.slice(1)}: ${validated.title.slice(0, 80)}`,
            source_url: validated.source_url ?? null,
            is_configured: false,
            request_count: 1,
            last_request_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (newFlow) {
          flowId = newFlow.id;
          flowIsUnconfigured = true;
          flowIsNewlyCreated = true;
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
          source: validated.source ?? autoDetectedSource ?? undefined,
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
      const routeConfig = ruleResult.actionConfig as { team_id?: string; user_ids?: string[]; required_role?: string; is_sequential?: boolean; required_approvals?: number };
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
      // Rule can override required_approvals (e.g. "if critical, require 3 approvers")
      if (routeConfig.required_approvals && routeConfig.required_approvals > requiredApprovals) {
        requiredApprovals = routeConfig.required_approvals;
      }
    }

    // Handle team assignment: resolve team members with can_approve = true
    // When a position is specified, only members holding that position qualify.
    if (assignedTeamId && !assignedApprovers) {
      const { data: teamMemberships } = await admin
        .from("team_memberships")
        .select("user_id, position_id")
        .eq("team_id", assignedTeamId);

      if (teamMemberships && teamMemberships.length > 0) {
        // Filter by position if specified; fall back to all members if none match
        let filteredMembers = teamMemberships;
        if (flowAssignedPositionId) {
          const positionFiltered = teamMemberships.filter(
            (m) => m.position_id === flowAssignedPositionId,
          );
          if (positionFiltered.length > 0) {
            filteredMembers = positionFiltered;
          }
        }

        const teamUserIds = filteredMembers.map(m => m.user_id);

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

    // 13d. Calculate first escalation deadline from org config
    const escalationConfig = org.escalation_config as EscalationConfig | null;
    const firstEscalation =
      !isAutoApproved && escalationConfig?.enabled
        ? calculateNextEscalation(escalationConfig, 0, new Date())
        : null;

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
        status: isAutoApproved || validated.is_log ? "approved" : "pending",
        is_log: validated.is_log ?? false,
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
        auto_approved: isAutoApproved || validated.is_log === true,
        decision_source: validated.is_log ? "auto_rule" : isAutoApproved ? "auto_rule" : null,
        decided_at: isAutoApproved || validated.is_log ? new Date().toISOString() : null,
        auto_action: effectiveAutoAction,
        auto_action_after_minutes: effectiveAutoMinutes,
        auto_action_deadline: autoActionDeadline,
        require_rejection_reason: validated.require_rejection_reason ?? false,
        conditions_met: validated.conditions && validated.conditions.length > 0 ? false : true,
        sla_deadline: slaDeadline,
        next_escalation_at: firstEscalation?.nextEscalationAt ?? null,
        notify_channel_ids: validated.notify_channel_ids ?? null,
        template_id: validated.template_id ?? null,
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

      // In-app notifications
      if (!isAutoApproved) {
        const sourceName = connectionName ?? validated.source ?? autoDetectedSource;
        const priorityLabel = effectivePriority.charAt(0).toUpperCase() + effectivePriority.slice(1);
        const bodyText = sourceName
          ? `${priorityLabel} priority · from ${sourceName.charAt(0).toUpperCase() + sourceName.slice(1)}`
          : `${priorityLabel} priority`;

        if (flowIsUnconfigured && (!targetUserIds || targetUserIds.length === 0)) {
          // Unconfigured flow: on the first request, notify connection owner
          // to configure routing. On subsequent requests, just notify about
          // the new request like normal.
          const ownerId = auth.type === "api_key"
            ? auth.connection.created_by
            : auth.type === "oauth" ? auth.userId : null;

          if (ownerId) {
            if (flowIsNewlyCreated) {
              await createInAppNotification({
                userId: ownerId,
                orgId: auth.orgId,
                category: "flow_assigned",
                title: `New flow needs configuration`,
                body: `"${validated.title}" arrived${sourceName ? ` from ${sourceName.charAt(0).toUpperCase() + sourceName.slice(1)}` : ""}. Configure routing to assign approvers.`,
                resourceType: "approval_request",
                resourceId: approval.id,
              });
            } else {
              await createInAppNotification({
                userId: ownerId,
                orgId: auth.orgId,
                category: "approval_awaiting",
                title: `New request: ${validated.title}`,
                body: bodyText,
                actorName: connectionName ?? undefined,
                resourceType: "approval_request",
                resourceId: approval.id,
              });
            }
          }

          // Also notify eligible approvers so the request isn't missed
          const { data: eligibleMembers } = await admin
            .from("org_memberships")
            .select("user_id")
            .eq("org_id", auth.orgId)
            .in("role", ["approver", "admin", "owner"]);
          const eligibleIds = (eligibleMembers ?? [])
            .map((m: { user_id: string }) => m.user_id)
            .filter((id: string) => id !== ownerId);

          if (eligibleIds.length > 0) {
            await createInAppNotificationBulk(eligibleIds, {
              orgId: auth.orgId,
              category: "approval_awaiting",
              title: `New request: ${validated.title}`,
              body: bodyText,
              actorName: connectionName ?? undefined,
              resourceType: "approval_request",
              resourceId: approval.id,
            });
          }
        } else if (targetUserIds && targetUserIds.length > 0) {
          // Configured flow with assigned approvers:
          // "Action needed" for current approvers
          await createInAppNotificationBulk(targetUserIds, {
            orgId: auth.orgId,
            category: "approval_awaiting",
            title: `New request: ${validated.title}`,
            body: bodyText,
            actorName: connectionName ?? undefined,
            resourceType: "approval_request",
            resourceId: approval.id,
          });

          // "FYI" for later-in-chain approvers (sequential only)
          if (effectiveIsSequential && assignedApprovers && assignedApprovers.length > 1) {
            const laterApprovers = assignedApprovers.slice(1).filter(
              (id: string) => !targetUserIds!.includes(id)
            );
            if (laterApprovers.length > 0) {
              await createInAppNotificationBulk(laterApprovers, {
                orgId: auth.orgId,
                category: "approval_created",
                title: `New request: ${validated.title}`,
                body: `${bodyText} · you'll be needed later in the approval chain`,
                actorName: connectionName ?? undefined,
                resourceType: "approval_request",
                resourceId: approval.id,
              });
            }
          }
        } else {
          // No assigned approvers (mode = "any" or "role_based"):
          // Notify all eligible org members
          const { data: eligibleMembers } = await admin
            .from("org_memberships")
            .select("user_id")
            .eq("org_id", auth.orgId)
            .in("role", ["approver", "admin", "owner"]);
          const notifyUserIds = (eligibleMembers ?? []).map((m: { user_id: string }) => m.user_id);

          if (notifyUserIds.length > 0) {
            await createInAppNotificationBulk(notifyUserIds, {
              orgId: auth.orgId,
              category: "approval_awaiting",
              title: `New request: ${validated.title}`,
              body: bodyText,
              actorName: connectionName ?? undefined,
              resourceType: "approval_request",
              resourceId: approval.id,
            });
          }
        }
      }
    });

    // 15a. Auto-watch: add the connection/OAuth owner as a watcher
    const watchOwnerId = auth.type === "api_key"
      ? auth.connection.created_by
      : auth.type === "oauth" ? auth.userId : null;
    if (watchOwnerId) {
      admin
        .from("request_watchers")
        .upsert({ request_id: approval.id, user_id: watchOwnerId }, { onConflict: "request_id,user_id" })
        ;
    }

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
            // In-app notification for org admins
            const botAdmin = createAdminClient();
            const { data: adminMembers } = await botAdmin
              .from("org_memberships")
              .select("user_id")
              .eq("org_id", auth.orgId)
              .in("role", ["owner", "admin"]);
            const adminIds = (adminMembers ?? []).map((m) => m.user_id);
            if (adminIds.length > 0) {
              await createInAppNotificationBulk(adminIds, {
                orgId: auth.orgId,
                category: "approval_awaiting",
                title: "Approver bottleneck detected",
                body: `${overloadedUserIds.length} approver(s) have too many pending requests. Consider redistributing workload.`,
                resourceType: "approval_request",
                resourceId: approval.id,
              });
            }
          }
        } catch (err) {
          console.error("[Approvals] Bottleneck check failed:", err);
        }
      });
    }

    // 15c. Auto-register new action types (fire-and-forget)
    if (effectiveActionType) {
      after(async () => {
        try {
          const { data: org } = await admin
            .from("organizations")
            .select("action_types")
            .eq("id", auth.orgId)
            .single();
          const existing: string[] = org?.action_types ?? [];
          if (!existing.includes(effectiveActionType)) {
            const updated = [...existing, effectiveActionType].sort();
            await admin
              .from("organizations")
              .update({ action_types: updated })
              .eq("id", auth.orgId);
          }
        } catch (err) {
          console.error("[Approvals] Auto-register action type failed:", err);
        }
      });
    }

    // 15d. Request limit approaching notification (fire-and-forget)
    if (billingCheck.current !== undefined && billingCheck.limit !== undefined && billingCheck.limit > 0) {
      const usageAfter = (billingCheck.current ?? 0) + 1;
      const pct = usageAfter / billingCheck.limit;
      if (pct >= 0.8) {
        after(async () => {
          try {
            const limitAdmin = createAdminClient();
            const { data: adminMembers } = await limitAdmin
              .from("org_memberships")
              .select("user_id")
              .eq("org_id", auth.orgId)
              .in("role", ["owner", "admin"]);
            const adminIds = (adminMembers ?? []).map((m) => m.user_id);
            if (adminIds.length > 0) {
              const isAtLimit = usageAfter >= billingCheck.limit!;
              await createInAppNotificationBulk(adminIds, {
                orgId: auth.orgId,
                category: "limit_approaching",
                title: isAtLimit ? "Monthly request limit reached" : "Approaching request limit",
                body: `${usageAfter}/${billingCheck.limit} requests used this month.${isAtLimit ? " New API requests will be rejected." : ""} Upgrade for unlimited requests.`,
                resourceType: "org",
                resourceId: auth.orgId,
              });
            }
          } catch {
            // Non-critical
          }
        });
      }
    }

    // 16. Invalidate caches
    revalidateTags(CacheTags.requests(auth.orgId), CacheTags.overview(auth.orgId), CacheTags.analytics(auth.orgId));

    // 17. Return created approval (with rate limit headers if applicable)
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
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
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
      page_size: searchParams.get("page_size") || searchParams.get("limit")
        ? Number(searchParams.get("page_size") || searchParams.get("limit"))
        : undefined,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      created_after: searchParams.get("created_after") ?? undefined,
      created_before: searchParams.get("created_before") ?? undefined,
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
      if (Array.isArray(params.status)) {
        query = query.in("status", params.status);
      } else {
        query = query.eq("status", params.status);
      }
    }

    if (params.priority) {
      query = query.eq("priority", params.priority);
    }

    if (params.search) {
      query = query.textSearch("search_vector", params.search, {
        type: "websearch",
      });
    }

    if (params.created_after) {
      query = query.gte("created_at", params.created_after);
    }

    if (params.created_before) {
      query = query.lte("created_at", params.created_before);
    }

    // 4b. Exclude approvals from a specific source_id (used by n8n triggers to skip self-created approvals)
    const excludeSourceId = searchParams.get("exclude_source_id");
    if (excludeSourceId) {
      // Find flow IDs matching this source_id and exclude them
      const { data: flows } = await admin
        .from("approval_flows")
        .select("id")
        .eq("org_id", auth.orgId)
        .eq("source_id", excludeSourceId);
      const excludeFlowIds = (flows ?? []).map((f: { id: string }) => f.id);
      if (excludeFlowIds.length > 0) {
        query = query.not("flow_id", "in", `(${excludeFlowIds.join(",")})`);
      }
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
      if (Array.isArray(params.status)) {
        countQuery = countQuery.in("status", params.status);
      } else {
        countQuery = countQuery.eq("status", params.status);
      }
    }

    if (params.priority) {
      countQuery = countQuery.eq("priority", params.priority);
    }

    if (params.search) {
      countQuery = countQuery.textSearch("search_vector", params.search, {
        type: "websearch",
      });
    }

    if (params.created_after) {
      countQuery = countQuery.gte("created_at", params.created_after);
    }

    if (params.created_before) {
      countQuery = countQuery.lte("created_at", params.created_before);
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
        ;
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
        ;

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
          // In-app notification for assigned approvers
          const approvers: string[] = breachedApproval.assigned_approvers ?? [];
          if (approvers.length > 0) {
            await createInAppNotificationBulk(approvers, {
              orgId: auth.orgId,
              category: "approval_expiring",
              title: "SLA breached",
              body: `"${breachedApproval.title}" has passed its SLA deadline.`,
              resourceType: "approval_request",
              resourceId: breachedApproval.id,
            });
          }
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
        ;

      // Audit the auto-action
      logAuditEvent({
        orgId: auth.orgId,
        action: `approval.auto_${newStatus}`,
        resourceType: "approval_request",
        resourceId: autoId,
        ipAddress: getClientIp(request),
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
    if (error instanceof ApiError) {
      console.log("[Approvals GET] auth error:", error.statusCode, error.message, error.code);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
