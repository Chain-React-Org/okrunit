// ---------------------------------------------------------------------------
// OKrunit -- Error Monitoring Types
// ---------------------------------------------------------------------------

export type ErrorSeverity = "info" | "warning" | "error" | "fatal";
export type ErrorIssueStatus = "unresolved" | "resolved" | "ignored" | "regressed";

export interface Breadcrumb {
  type: "api" | "db" | "auth" | "navigation" | "user" | "error" | "log";
  category: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface CaptureErrorParams {
  error: unknown;
  severity?: ErrorSeverity;
  service?: string;
  requestUrl?: string;
  requestMethod?: string;
  correlationId?: string;
  userId?: string;
  orgId?: string;
  tags?: Record<string, string>;
  context?: Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
}

export interface ErrorIssue {
  id: string;
  fingerprint: string;
  title: string;
  severity: ErrorSeverity;
  status: ErrorIssueStatus;
  service: string | null;
  event_count: number;
  affected_users: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_in_release: string | null;
  first_release: string | null;
  last_release: string | null;
  tags: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ErrorEvent {
  id: string;
  issue_id: string;
  error_type: string;
  message: string;
  stack_trace: string | null;
  severity: ErrorSeverity;
  service: string | null;
  environment: string;
  release: string | null;
  request_url: string | null;
  request_method: string | null;
  correlation_id: string | null;
  user_id: string | null;
  org_id: string | null;
  tags: Record<string, string>;
  context: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  created_at: string;
}
