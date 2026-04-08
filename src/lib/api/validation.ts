// ---------------------------------------------------------------------------
// OKrunit -- Zod Validation Schemas for API Endpoints
// ---------------------------------------------------------------------------

import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

// ---- Shared Enums ---------------------------------------------------------

const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

const decisionEnum = z.enum(["approve", "reject"]);

const decisionSourceEnum = z.enum([
  "dashboard",
  "email",
  "slack",
  "push",
  "api",
  "auto_rule",
  "batch",
]);

const statusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
]);

const ruleActionEnum = z.enum(["auto_approve", "route"]);

// ---- Approval Requests ----------------------------------------------------

const autoActionEnum = z.enum(["approve", "reject"]);

export const createApprovalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  action_type: z.string().optional(),
  priority: priorityEnum.optional(),
  callback_url: z.url().optional(),
  callback_headers: z.record(z.string(), z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  context_html: z.string().max(50_000).optional(),
  expires_at: z.iso.datetime().optional(),
  idempotency_key: z.string().optional(),
  required_approvals: z.int().min(1).max(10).default(1).optional(),
  assigned_approvers: z.array(z.uuid()).min(1).max(10).optional(),
  assigned_team_id: z.uuid().optional(),
  source: z.string().max(50).optional(),
  source_id: z.string().max(200).optional(),
  source_name: z.string().max(200).optional(),
  source_url: z.url().max(2000).optional(),
  is_sequential: z.boolean().optional(),
  auto_action: autoActionEnum.optional(),
  auto_action_after_minutes: z.int().min(1).max(43200).optional(),
  require_rejection_reason: z.boolean().optional(),
  conditions: z.array(z.object({
    name: z.string().min(1).max(200),
    check_type: z.enum(["webhook", "manual"]),
    webhook_url: z.string().url().optional(),
    description: z.string().max(1000).optional(),
  })).max(20).optional(),
  notify_channel_ids: z.array(z.uuid()).min(1).max(50).optional(),
  is_log: z.boolean().optional(),
});

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;

// ---- Approval Responses ---------------------------------------------------

export const respondApprovalSchema = z.object({
  decision: decisionEnum,
  comment: z.string().max(2000).optional(),
  source: decisionSourceEnum.optional(),
  scheduled_execution_at: z.string().datetime().optional(),
});

export type RespondApprovalInput = z.infer<typeof respondApprovalSchema>;

// ---- Connections ----------------------------------------------------------

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  rate_limit_per_hour: z.int().min(1).max(10_000).default(100).nullable().optional(),
  allowed_action_types: z.array(z.string()).optional(),
  max_priority: priorityEnum.nullable().optional(),
  scoping_rules: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const updateConnectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  rate_limit_per_hour: z.int().min(1).max(10_000).nullable().optional(),
  allowed_action_types: z.array(z.string()).optional(),
  max_priority: priorityEnum.nullable().optional(),
  scoping_rules: z.record(z.string(), z.unknown()).nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;

// ---- Pagination & Filtering -----------------------------------------------

export const paginationSchema = z.object({
  page: z.int().min(1).default(1).optional(),
  page_size: z
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .optional(),
  status: z.union([statusEnum, z.string().transform((s) => s.split(",").map((v) => v.trim())).pipe(z.array(statusEnum))]).optional(),
  priority: priorityEnum.optional(),
  search: z.string().max(500).optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ---- Comments -------------------------------------------------------------

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  source: z.string().max(50).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ---- Batch Operations -----------------------------------------------------

export const batchApprovalSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
  decision: decisionEnum,
  comment: z.string().optional(),
});

export type BatchApprovalInput = z.infer<typeof batchApprovalSchema>;

export const batchArchiveSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
  action: z.enum(["archive", "unarchive"]),
});

export type BatchArchiveInput = z.infer<typeof batchArchiveSchema>;

// ---- Approval Rules -------------------------------------------------------

export const createRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  priority_order: z.int().optional(),
  conditions: z.record(z.string(), z.unknown()),
  action: ruleActionEnum,
  action_config: z.record(z.string(), z.unknown()).optional(),
  connection_id: z.uuid().optional(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;

// ---- Teams ----------------------------------------------------------------

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

// ---- Delegations ----------------------------------------------------------

export const createDelegationSchema = z.object({
  delegate_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime(),
});

export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;

// ---- Trust Counters -------------------------------------------------------

const trustMatchFieldEnum = z.enum([
  "action_type",
  "source",
  "title_pattern",
  "connection_id",
]);

export const createTrustCounterSchema = z.object({
  match_field: trustMatchFieldEnum,
  match_value: z.string().min(1).max(500),
  auto_approve_threshold: z.int().min(1).max(10000).optional(),
});

export type CreateTrustCounterInput = z.infer<typeof createTrustCounterSchema>;

export const updateTrustCounterSchema = z.object({
  auto_approve_threshold: z.int().min(1).max(10000).nullable().optional(),
  // Allow resetting the counter state manually.
  consecutive_approvals: z.int().min(0).optional(),
  auto_approve_active: z.boolean().optional(),
});

export type UpdateTrustCounterInput = z.infer<typeof updateTrustCounterSchema>;

// ---- Organization Settings ------------------------------------------------

const rejectionReasonPolicyEnum = z.enum(["optional", "required", "required_high_critical"]);

const slaConfigSchema = z.object({
  low: z.number().int().min(1).nullable(),
  medium: z.number().int().min(1).nullable(),
  high: z.number().int().min(1).nullable(),
  critical: z.number().int().min(1).nullable(),
});

const geoRestrictionsSchema = z.object({
  enabled: z.boolean(),
  allowed_countries: z.array(z.string().length(2)),
});

const fourEyesConfigSchema = z.object({
  enabled: z.boolean(),
  action_types: z.array(z.string().max(100)),
  min_priority: priorityEnum.nullable(),
});

export const updateOrgSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rejection_reason_policy: rejectionReasonPolicyEnum.optional(),
  sla_config: slaConfigSchema.optional(),
  bottleneck_threshold: z.number().int().min(1).max(1000).optional(),
  bottleneck_alert_enabled: z.boolean().optional(),
  ip_allowlist: z.array(z.string().max(50)).max(200).optional(),
  geo_restrictions: geoRestrictionsSchema.optional(),
  require_reauth_for_critical: z.boolean().optional(),
  session_timeout_minutes: z.number().int().min(5).max(43200).optional(),
  four_eyes_config: fourEyesConfigSchema.optional(),
});

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;

// ---- Bulk Approval Rules --------------------------------------------------

const bulkRuleActionEnum = z.enum(["approve", "reject", "archive"]);

export const createBulkRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  action: bulkRuleActionEnum,
  status_filter: statusEnum.optional().default("pending"),
  priority_filter: z.array(priorityEnum).optional(),
  source_filter: z.array(z.string().max(100)).optional(),
  action_type_filter: z.array(z.string().max(100)).optional(),
  older_than_minutes: z.int().min(1).max(525600).optional(),
  is_scheduled: z.boolean().optional(),
  schedule_cron: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
});

export type CreateBulkRuleInput = z.infer<typeof createBulkRuleSchema>;

export const updateBulkRuleSchema = createBulkRuleSchema.partial();

export type UpdateBulkRuleInput = z.infer<typeof updateBulkRuleSchema>;

// ---- Messaging Connection Routing Rules -----------------------------------

export const routingRulesSchema = z.object({
  sources: z.array(z.string().max(100)).max(50).optional(),
  action_types: z.array(z.string().max(200)).max(50).optional(),
  priorities: z.array(priorityEnum).optional(),
});

export type RoutingRulesInput = z.infer<typeof routingRulesSchema>;

export const updateMessagingConnectionSchema = z.object({
  routing_rules: routingRulesSchema.optional(),
  priority_filter: priorityEnum.optional(),
  notify_on_create: z.boolean().optional(),
  notify_on_decide: z.boolean().optional(),
});

export type UpdateMessagingConnectionInput = z.infer<typeof updateMessagingConnectionSchema>;

// ---- Approval Conditions --------------------------------------------------

const conditionCheckTypeEnum = z.enum(["webhook", "manual"]);
const conditionStatusEnum = z.enum(["pending", "met", "failed"]);

export const createConditionSchema = z.object({
  name: z.string().min(1).max(200),
  check_type: conditionCheckTypeEnum,
  webhook_url: z.string().url().optional(),
  description: z.string().max(1000).optional(),
});

export type CreateConditionInput = z.infer<typeof createConditionSchema>;

export const updateConditionSchema = z.object({
  status: conditionStatusEnum,
  check_result: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateConditionInput = z.infer<typeof updateConditionSchema>;

// ---- Scheduled Execution Cancellation -------------------------------------

export const cancelScheduledExecutionSchema = z.object({
  execution_status: z.literal("cancelled"),
});

export type CancelScheduledExecutionInput = z.infer<typeof cancelScheduledExecutionSchema>;

// ---- Export ---------------------------------------------------------------

export const exportQuerySchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format").optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
});

export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

// ---- Analytics ------------------------------------------------------------

export const analyticsQuerySchema = z.object({
  period: z.enum(["day", "week", "month"]).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/).optional(),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

// ---- Webhook Delivery Logs ------------------------------------------------

export const webhookLogQuerySchema = z.object({
  request_id: z.string().uuid().optional(),
  status: z.enum(["success", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type WebhookLogQueryInput = z.infer<typeof webhookLogQuerySchema>;
