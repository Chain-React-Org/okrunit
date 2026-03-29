// ---------------------------------------------------------------------------
// OKRunit -- Database Types
// Generated TypeScript types for all Supabase/Postgres tables and enums.
// ---------------------------------------------------------------------------

// ---- Enums ----------------------------------------------------------------

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type ExecutionStatus = "immediate" | "scheduled" | "executed" | "cancelled";

export type ConditionCheckType = "webhook" | "manual";

export type ConditionStatus = "pending" | "met" | "failed";

export type ApprovalPriority = "low" | "medium" | "high" | "critical";

export type UserRole = "owner" | "admin" | "approver" | "member";

export type InviteRole = "admin" | "approver" | "member";

export type MessagingPlatform = "discord" | "email" | "slack" | "teams" | "telegram";

export type DecisionSource =
  | "dashboard"
  | "email"
  | "slack"
  | "teams"
  | "telegram"
  | "discord"
  | "push"
  | "api"
  | "auto_rule"
  | "batch";

export type EmailAction = "approve" | "reject";

export type ApprovalRuleAction = "auto_approve" | "route";

export type RejectionReasonPolicy = "optional" | "required" | "required_high_critical";

export type BulkRuleAction = "approve" | "reject" | "archive";

export type DashboardLayout = "cards" | "grouped" | "split";

export type VoteValue = "approve" | "reject";

export type VoteSource = "dashboard" | "email" | "slack" | "teams" | "telegram" | "discord" | "push" | "api";

export type ApproverMode = "any" | "designated" | "role_based";

export interface CreatedByInfo {
  type: "api_key" | "oauth";
  connection_id?: string;
  connection_name?: string;
  client_id?: string;
  client_name?: string;
  user_id?: string;
}

// ---- Table Row Interfaces -------------------------------------------------

export type AutoAction = "approve" | "reject";

export type TrustMatchField = "action_type" | "source" | "title_pattern" | "connection_id";

export interface SlaConfig {
  low: number | null;
  medium: number | null;
  high: number | null;
  critical: number | null;
}

export interface GeoRestrictions {
  enabled: boolean;
  allowed_countries: string[];
}

export interface FourEyesConfig {
  enabled: boolean;
  action_types: string[];
  min_priority: ApprovalPriority | null;
}

export interface Organization {
  id: string;
  name: string;
  emergency_stop_active: boolean;
  emergency_stop_activated_at: string | null;
  emergency_stop_activated_by: string | null;
  default_auto_action: AutoAction | null;
  default_auto_action_minutes: number | null;
  rejection_reason_policy: RejectionReasonPolicy;
  sla_config: SlaConfig;
  bottleneck_threshold: number;
  bottleneck_alert_enabled: boolean;
  ip_allowlist: string[];
  geo_restrictions: GeoRestrictions;
  require_reauth_for_critical: boolean;
  session_timeout_minutes: number;
  four_eyes_config: FourEyesConfig;
  auto_approvals_paused: boolean;
  sso_domain: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_app_admin: boolean;
  deletion_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  id: string;
  user_id: string;
  org_id: string;
  role: UserRole;
  can_approve: boolean;
  is_default: boolean;
  auto_approvals_paused: boolean;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  api_key_hash: string;
  api_key_prefix: string;
  is_active: boolean;
  rate_limit_per_hour: number;
  allowed_action_types: string[] | null;
  max_priority: ApprovalPriority | null;
  scoping_rules: Record<string, unknown> | null;
  last_used_at: string | null;
  rotated_at: string | null;
  previous_key_hash: string | null;
  previous_key_expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  org_id: string;
  connection_id: string | null;
  flow_id: string | null;
  source: string | null;
  title: string;
  description: string | null;
  action_type: string;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  callback_url: string | null;
  callback_headers: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  context_html: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  decision_source: DecisionSource | null;
  expires_at: string | null;
  idempotency_key: string | null;
  required_approvals: number;
  current_approvals: number;
  auto_approved: boolean;
  assigned_approvers: string[] | null;
  assigned_team_id: string | null;
  created_by: CreatedByInfo | null;
  required_role: UserRole | null;
  is_sequential: boolean;
  risk_score: number | null;
  risk_level: string | null;
  risk_factors: RiskFactor[] | null;
  delegated_from: string | null;
  delegation_id: string | null;
  auto_action: AutoAction | null;
  auto_action_after_minutes: number | null;
  auto_action_deadline: string | null;
  auto_action_warning_sent: boolean;
  require_rejection_reason: boolean;
  scheduled_execution_at: string | null;
  execution_status: ExecutionStatus;
  conditions: Record<string, unknown>[];
  conditions_met: boolean;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_breached_at: string | null;
  sla_warning_sent: boolean;
  notify_channel_ids: string[] | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  reason: string;
}

export interface ApprovalCondition {
  id: string;
  request_id: string;
  name: string;
  description: string | null;
  check_type: ConditionCheckType;
  webhook_url: string | null;
  status: ConditionStatus;
  checked_at: string | null;
  check_result: Record<string, unknown> | null;
  created_at: string;
}

export interface ApprovalFlow {
  id: string;
  org_id: string;
  source: string;
  source_id: string;
  source_url: string | null;
  name: string;
  is_configured: boolean;
  default_priority: ApprovalPriority | null;
  default_expiration_hours: number | null;
  default_required_approvals: number | null;
  default_action_type: string | null;
  assigned_team_id: string | null;
  assigned_approvers: string[] | null;
  approver_mode: ApproverMode;
  required_role: UserRole | null;
  is_sequential: boolean;
  apply_for_next: number | null;
  request_count: number;
  last_request_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: InviteRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  team_ids: string[];
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  connection_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
  minimum_priority: ApprovalPriority;
  skip_approval_confirmation: boolean;
  dashboard_layout: DashboardLayout;
  created_at: string;
  updated_at: string;
}

export interface RoutingRules {
  sources?: string[];
  action_types?: string[];
  priorities?: string[];
}

export interface MessagingConnection {
  id: string;
  org_id: string;
  platform: MessagingPlatform;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  bot_token: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  channel_id: string;
  channel_name: string | null;
  webhook_url: string | null;
  is_active: boolean;
  notify_on_create: boolean;
  notify_on_decide: boolean;
  priority_filter: string;
  routing_rules: RoutingRules;
  installed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailActionToken {
  id: string;
  request_id: string;
  user_id: string;
  action: EmailAction;
  token: string;
  consumed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ApprovalComment {
  id: string;
  request_id: string;
  user_id: string | null;
  connection_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  request_id: string;
  connection_id: string;
  url: string;
  method: string;
  request_headers: Record<string, unknown>;
  request_body: Record<string, unknown>;
  response_status: number | null;
  response_headers: Record<string, unknown> | null;
  response_body: string | null;
  duration_ms: number | null;
  attempt_number: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface ApprovalRule {
  id: string;
  org_id: string;
  connection_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  priority_order: number;
  conditions: Record<string, unknown>;
  action: ApprovalRuleAction;
  action_config: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export interface ApprovalVote {
  id: string;
  request_id: string;
  user_id: string;
  vote: VoteValue;
  comment: string | null;
  source: VoteSource;
  created_at: string;
}

export interface SavedFilter {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  filters: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalAttachment {
  id: string;
  request_id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  storage_path: string;
  uploaded_by: string | null;
  connection_id: string | null;
  created_at: string;
}

// ---- Webhook Tester Types -------------------------------------------------

export interface WebhookTestEndpoint {
  id: string;
  org_id: string;
  token: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookTestRequest {
  id: string;
  endpoint_id: string;
  org_id: string;
  method: string;
  url: string;
  query_params: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: string | null;
  body_json: Record<string, unknown> | null;
  content_type: string | null;
  ip_address: string | null;
  created_at: string;
}

// ---- OAuth 2.0 Types -----------------------------------------------------

export interface OAuthClient {
  id: string;
  org_id: string;
  name: string;
  client_id: string;
  client_secret_hash: string;
  client_secret_prefix: string;
  redirect_uris: string[];
  scopes: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthAuthorizationCode {
  id: string;
  client_id: string;
  user_id: string;
  org_id: string;
  code_hash: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string | null;
  code_challenge_method: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface OAuthAccessToken {
  id: string;
  client_id: string;
  user_id: string;
  org_id: string;
  token_hash: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface OAuthRefreshToken {
  id: string;
  access_token_id: string | null;
  client_id: string;
  user_id: string;
  org_id: string;
  token_hash: string;
  scopes: string[];
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  previous_token_hash: string | null;
  previous_token_expires_at: string | null;
  created_at: string;
}

export interface ApprovalDelegation {
  id: string;
  org_id: string;
  delegator_id: string;
  delegate_id: string;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

export interface ApprovalTrustCounter {
  id: string;
  org_id: string;
  match_field: TrustMatchField;
  match_value: string;
  consecutive_approvals: number;
  total_approvals: number;
  total_rejections: number;
  last_decision: "approved" | "rejected" | null;
  last_decision_at: string | null;
  auto_approve_threshold: number | null;
  auto_approve_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BulkApprovalRule {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  action: BulkRuleAction;
  status_filter: string;
  priority_filter: string[] | null;
  source_filter: string[] | null;
  action_type_filter: string[] | null;
  older_than_minutes: number | null;
  is_scheduled: boolean;
  schedule_cron: string | null;
  is_active: boolean;
  last_run_at: string | null;
  last_run_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BulkApprovalRuleInsert = Omit<BulkApprovalRule, "id" | "last_run_at" | "last_run_count" | "created_at" | "updated_at">;

// ---- GitHub Integration Types ----------------------------------------------

export interface GitHubInstallation {
  id: string;
  org_id: string;
  installation_id: number;
  account_login: string;
  account_type: "User" | "Organization";
  repositories: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GitHubInstallationInsert = Omit<
  GitHubInstallation,
  "id" | "created_at" | "updated_at"
>;

export type GitHubInstallationUpdate = Partial<
  Omit<GitHubInstallation, "id" | "created_at">
> & { id: string };

// ---- Export Types ----------------------------------------------------------

export interface ExportApproval {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  action_type: string | null;
  source: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by_name: string | null;
  decision_comment: string | null;
  decision_source: string | null;
  required_approvals: number;
  current_approvals: number;
  risk_score: number | null;
  risk_level: string | null;
  sla_breached: boolean;
}

// ---- Bottleneck Alert Types -----------------------------------------------

export interface BottleneckAlert {
  user_id: string;
  user_name: string | null;
  user_email: string;
  pending_count: number;
  threshold: number;
  excess: number;
}

// ---- Insert Types (omit server-generated columns) -------------------------

export type OrganizationInsert = Omit<Organization, "id" | "created_at" | "updated_at">;
export type UserProfileInsert = Omit<UserProfile, "created_at" | "updated_at">;
export type OrgMembershipInsert = Omit<OrgMembership, "id" | "created_at" | "updated_at">;
export type ConnectionInsert = Omit<
  Connection,
  "id" | "last_used_at" | "rotated_at" | "previous_key_hash" | "previous_key_expires_at" | "created_at" | "updated_at"
>;
export type ApprovalRequestInsert = Omit<
  ApprovalRequest,
  | "id"
  | "status"
  | "decided_by"
  | "decided_at"
  | "decision_comment"
  | "decision_source"
  | "current_approvals"
  | "auto_approved"
  | "created_at"
  | "updated_at"
>;
export type OrgInviteInsert = Omit<OrgInvite, "id" | "accepted_at" | "created_at">;
export type AuditLogEntryInsert = Omit<AuditLogEntry, "id" | "created_at">;
export type PushSubscriptionInsert = Omit<PushSubscription, "id" | "created_at">;
export type NotificationSettingsInsert = Omit<NotificationSettings, "id" | "created_at" | "updated_at">;
export type EmailActionTokenInsert = Omit<EmailActionToken, "id" | "consumed_at" | "created_at">;
export type ApprovalCommentInsert = Omit<ApprovalComment, "id" | "created_at" | "updated_at">;
export type WebhookDeliveryLogInsert = Omit<WebhookDeliveryLog, "id" | "created_at">;
export type ApprovalRuleInsert = Omit<ApprovalRule, "id" | "created_at" | "updated_at">;
export type TeamInsert = Omit<Team, "id" | "created_at" | "updated_at">;
export type TeamMembershipInsert = Omit<TeamMembership, "id" | "created_at">;
export type ApprovalVoteInsert = Omit<ApprovalVote, "id" | "created_at">;
export type SavedFilterInsert = Omit<SavedFilter, "id" | "created_at" | "updated_at">;
export type ApprovalAttachmentInsert = Omit<ApprovalAttachment, "id" | "created_at">;
export type ApprovalConditionInsert = Omit<ApprovalCondition, "id" | "status" | "checked_at" | "check_result" | "created_at">;
export type ApprovalDelegationInsert = Omit<ApprovalDelegation, "id" | "created_at">;
export type ApprovalTrustCounterInsert = Omit<ApprovalTrustCounter, "id" | "consecutive_approvals" | "total_approvals" | "total_rejections" | "last_decision" | "last_decision_at" | "auto_approve_active" | "created_at" | "updated_at">;
export type MessagingConnectionInsert = Omit<MessagingConnection, "id" | "created_at" | "updated_at">;
export type WebhookTestEndpointInsert = Omit<WebhookTestEndpoint, "id" | "created_at" | "updated_at">;
export type WebhookTestRequestInsert = Omit<WebhookTestRequest, "id" | "created_at">;

// ---- Update Types (all fields optional except id) -------------------------

export type OrganizationUpdate = Partial<Omit<Organization, "id" | "created_at">> & { id: string };
export type UserProfileUpdate = Partial<Omit<UserProfile, "id" | "created_at">> & { id: string };
export type OrgMembershipUpdate = Partial<Omit<OrgMembership, "id" | "created_at">> & { id: string };
export type ConnectionUpdate = Partial<Omit<Connection, "id" | "created_at">> & { id: string };
export type ApprovalRequestUpdate = Partial<Omit<ApprovalRequest, "id" | "created_at">> & { id: string };
export type NotificationSettingsUpdate = Partial<Omit<NotificationSettings, "id" | "created_at">> & { id: string };
export type ApprovalRuleUpdate = Partial<Omit<ApprovalRule, "id" | "created_at">> & { id: string };
export type SavedFilterUpdate = Partial<Omit<SavedFilter, "id" | "created_at">> & { id: string };
export type ApprovalCommentUpdate = Partial<Omit<ApprovalComment, "id" | "created_at">> & { id: string };
export type ApprovalTrustCounterUpdate = Partial<Omit<ApprovalTrustCounter, "id" | "created_at">> & { id: string };
export type MessagingConnectionUpdate = Partial<Omit<MessagingConnection, "id" | "created_at">> & { id: string };

// ---- Analytics Types ------------------------------------------------------

export interface AnalyticsSummary {
  total_approvals: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
  approval_rate: number;
  avg_response_time_minutes: number;
  median_response_time_minutes: number;
}

export interface AnalyticsDailyTrend {
  date: string;
  created: number;
  approved: number;
  rejected: number;
}

export interface AnalyticsSourceMetric {
  source: string;
  count: number;
  approval_rate: number;
}

export interface AnalyticsPriorityMetric {
  priority: string;
  count: number;
  avg_response_minutes: number;
}

export interface AnalyticsActionTypeMetric {
  action_type: string;
  count: number;
}

export interface AnalyticsRejectionReasonMetric {
  reason: string;
  count: number;
}

export interface AnalyticsUserMetric {
  user_id: string;
  user_name: string;
  approved: number;
  rejected: number;
  avg_response_minutes: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  trends: {
    daily: AnalyticsDailyTrend[];
  };
  by_source: AnalyticsSourceMetric[];
  by_priority: AnalyticsPriorityMetric[];
  by_action_type: AnalyticsActionTypeMetric[];
  top_rejection_reasons: AnalyticsRejectionReasonMetric[];
  per_user: AnalyticsUserMetric[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export interface CostOfDelayItem {
  id: string;
  title: string;
  priority: string;
  age_minutes: number;
  estimated_impact: string | null;
  created_at: string;
  action_type: string | null;
  source: string | null;
}

export interface CostOfDelayResponse {
  summary: {
    total_pending: number;
    avg_age_minutes: number;
    critical_pending: number;
    high_pending: number;
    oldest_age_minutes: number;
  };
  items: CostOfDelayItem[];
}

export interface WebhookDeliveryListResponse {
  data: WebhookDeliveryLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface WebhookReplayResponse {
  message: string;
  original_delivery_id: string;
  replay_result: WebhookDeliveryLog | null;
}

export interface ApprovalWebhookHistoryResponse {
  approval_id: string;
  summary: {
    total_attempts: number;
    success_count: number;
    failure_count: number;
    latest_status: string | null;
    latest_attempt_at: string | null;
  };
  deliveries: WebhookDeliveryLog[];
}

// ---- Billing & Plans -------------------------------------------------------

export type BillingPlan = "free" | "pro" | "business" | "enterprise";

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "trialing" | "expired";

export type BillingCycle = "monthly" | "yearly" | "custom";

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface Plan {
  id: BillingPlan;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  max_requests_per_month: number; // -1 = unlimited
  max_connections: number;        // -1 = unlimited
  max_team_members: number;       // -1 = unlimited
  history_retention_days: number; // -1 = unlimited
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  plan_id: BillingPlan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageMetric {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  requests_count: number;
  connections_count: number;
  team_members_count: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  stripe_invoice_id: string | null;
  status: InvoiceStatus;
  amount_cents: number;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Helper: check if a plan limit is unlimited */
export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

// ---- SSO Config -----------------------------------------------------------

export interface SSOConfig {
  id: string;
  org_id: string;
  provider: string;
  entity_id: string;
  sso_url: string;
  certificate: string;
  attribute_mapping: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SSOConfigInsert = Omit<SSOConfig, "id" | "created_at" | "updated_at">;
export type SSOConfigUpdate = Partial<Omit<SSOConfig, "id" | "org_id" | "created_at">> & { id: string };

// ---- Multi-Step Approvals --------------------------------------------------

export type ApprovalStepStatus = "waiting" | "active" | "approved" | "rejected" | "skipped";

export interface ApprovalStep {
  id: string;
  request_id: string;
  step_order: number;
  name: string;
  status: ApprovalStepStatus;
  assigned_team_id: string | null;
  assigned_user_ids: string[] | null;
  assigned_role: UserRole | null;
  required_approvals: number;
  current_approvals: number;
  timeout_minutes: number | null;
  activated_at: string | null;
  completed_at: string | null;
  decided_by: string | null;
  decision_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepVote {
  id: string;
  step_id: string;
  request_id: string;
  user_id: string;
  vote: "approve" | "reject";
  comment: string | null;
  source: string;
  created_at: string;
}
