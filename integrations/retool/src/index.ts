/**
 * OKRunit Approval Gate for Retool
 *
 * Use this module in Retool custom components and workflows to gate
 * sensitive actions behind human approval.
 */

export interface ApprovalOptions {
  /** OKRunit API key (starts with gk_) */
  apiKey: string;
  /** OKRunit instance URL */
  apiUrl?: string;
  /** Approval request title */
  title?: string;
  /** Additional context for the reviewer */
  description?: string;
  /** Priority level */
  priority?: "low" | "medium" | "high" | "critical";
  /** JSON metadata to attach */
  metadata?: Record<string, unknown>;
  /** Max wait time in seconds (default: 3600) */
  timeout?: number;
  /** Polling interval in seconds (default: 10) */
  pollInterval?: number;
}

export interface ApprovalResult {
  /** The approval request UUID */
  id: string;
  /** Decision status */
  status: "approved" | "rejected" | "timeout";
  /** Name of the person who decided */
  decidedBy?: string;
  /** ISO timestamp of the decision */
  decidedAt?: string;
  /** Comment from the decider */
  comment?: string;
}

interface ApiApproval {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  decided_by_name?: string;
  decided_at?: string;
  decision_comment?: string;
  created_at: string;
  updated_at: string;
}

async function apiRequest(
  method: string,
  url: string,
  apiKey: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OKRunit API error (${resp.status}): ${text}`);
  }

  return resp.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateIdempotencyKey(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `retool-${timestamp}-${random}`;
}

/**
 * Request human approval from within a Retool app or workflow.
 *
 * Creates an approval request in OKRunit, then polls until the request
 * is approved, rejected, or times out.
 *
 * @example
 * ```ts
 * import { requestApproval } from "@okrunit/retool";
 *
 * const result = await requestApproval({
 *   apiKey: "gk_your_api_key",
 *   title: "Delete 500 user records",
 *   description: "Bulk deletion requested by admin",
 *   priority: "critical",
 * });
 *
 * if (result.status !== "approved") {
 *   throw new Error(`Action blocked: ${result.status}`);
 * }
 * ```
 */
export async function requestApproval(
  options: ApprovalOptions,
): Promise<ApprovalResult> {
  const {
    apiKey,
    apiUrl = "https://app.okrunit.com",
    priority = "medium",
    timeout = 3600,
    pollInterval = 10,
  } = options;

  if (!apiKey) {
    throw new Error("apiKey is required");
  }

  const title = options.title ?? "Approval request from Retool";

  const idempotencyKey = generateIdempotencyKey();

  const body: Record<string, unknown> = {
    title,
    source: "retool",
    priority,
    idempotency_key: idempotencyKey,
  };

  if (options.description) {
    body.description = options.description;
  }

  if (options.metadata) {
    body.metadata = options.metadata;
  }

  // Create approval request
  const approval = (await apiRequest(
    "POST",
    `${apiUrl}/api/v1/approvals`,
    apiKey,
    body,
  )) as ApiApproval;

  if (!approval.id) {
    throw new Error("Failed to create approval request");
  }

  // Poll for decision
  const deadline = Date.now() + timeout * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000);

    const result = (await apiRequest(
      "GET",
      `${apiUrl}/api/v1/approvals/${approval.id}`,
      apiKey,
    )) as ApiApproval;

    if (result.status === "approved" || result.status === "rejected") {
      return {
        id: approval.id,
        status: result.status as "approved" | "rejected",
        decidedBy: result.decided_by_name,
        decidedAt: result.decided_at,
        comment: result.decision_comment,
      };
    }
  }

  // Timeout
  return {
    id: approval.id,
    status: "timeout",
  };
}

/**
 * Get the current status of an approval request.
 *
 * Useful for checking status without polling in a loop --
 * for example, refreshing status on a button click in Retool.
 */
export async function getApprovalStatus(options: {
  apiKey: string;
  apiUrl?: string;
  approvalId: string;
}): Promise<ApprovalResult> {
  const { apiKey, apiUrl = "https://app.okrunit.com", approvalId } = options;

  if (!apiKey) {
    throw new Error("apiKey is required");
  }

  if (!approvalId) {
    throw new Error("approvalId is required");
  }

  const result = (await apiRequest(
    "GET",
    `${apiUrl}/api/v1/approvals/${approvalId}`,
    apiKey,
  )) as ApiApproval;

  return {
    id: result.id,
    status:
      result.status === "approved" || result.status === "rejected"
        ? result.status
        : "timeout",
    decidedBy: result.decided_by_name,
    decidedAt: result.decided_at,
    comment: result.decision_comment,
  };
}
