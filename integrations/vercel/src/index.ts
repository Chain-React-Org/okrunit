/**
 * OKRunit Approval Gate for Vercel Deployments
 *
 * Use this module to gate Vercel deployments behind human approval.
 * Works in build scripts, GitHub Actions, or any Node.js context.
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

/**
 * Collect Vercel deployment context from environment variables.
 */
function getVercelContext(): Record<string, string> {
  const env = process.env;
  const context: Record<string, string> = {};

  const vars: Record<string, string | undefined> = {
    project: env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL,
    environment: env.VERCEL_ENV,
    git_ref: env.VERCEL_GIT_COMMIT_REF,
    git_sha: env.VERCEL_GIT_COMMIT_SHA,
    git_message: env.VERCEL_GIT_COMMIT_MESSAGE,
    git_author: env.VERCEL_GIT_COMMIT_AUTHOR_NAME,
    git_repo: env.VERCEL_GIT_REPO_SLUG,
    git_provider: env.VERCEL_GIT_PROVIDER,
  };

  for (const [key, value] of Object.entries(vars)) {
    if (value) {
      context[key] = value;
    }
  }

  return context;
}

/**
 * Request human approval before proceeding with a Vercel deployment.
 *
 * Creates an approval request in OKRunit, then polls until the request
 * is approved, rejected, or times out.
 *
 * @example
 * ```ts
 * import { requestApproval } from "@okrunit/vercel";
 *
 * const result = await requestApproval({
 *   apiKey: process.env.OKRUNIT_API_KEY!,
 *   title: "Deploy to production",
 *   priority: "critical",
 * });
 *
 * if (result.status !== "approved") {
 *   console.error(`Deployment blocked: ${result.status}`);
 *   process.exit(1);
 * }
 * ```
 */
export async function requestApproval(
  options: ApprovalOptions,
): Promise<ApprovalResult> {
  const {
    apiKey,
    apiUrl = process.env.OKRUNIT_API_URL ?? "https://app.okrunit.com",
    priority = "medium",
    timeout = 3600,
    pollInterval = 10,
  } = options;

  if (!apiKey) {
    throw new Error("apiKey is required");
  }

  const vercelContext = getVercelContext();
  const environment = vercelContext.environment ?? "unknown";
  const project = vercelContext.project ?? vercelContext.git_repo ?? "unknown";

  const title =
    options.title ??
    `Vercel deployment approval: ${project} (${environment})`;

  const description =
    options.description ??
    (vercelContext.git_message
      ? `Deploying: ${vercelContext.git_message}`
      : undefined);

  // Generate idempotency key from deployment context
  const idempotencyKey = `vercel-${project}-${environment}-${vercelContext.git_sha ?? Date.now()}`;

  const metadata: Record<string, unknown> = {
    ...vercelContext,
    ...(options.metadata ?? {}),
  };

  // Create approval request
  const body: Record<string, unknown> = {
    title,
    source: "vercel",
    priority,
    idempotency_key: idempotencyKey,
    metadata,
  };

  if (description) {
    body.description = description;
  }

  console.log(`[okrunit] Creating approval request: "${title}"`);

  const approval = (await apiRequest(
    "POST",
    `${apiUrl}/api/v1/approvals`,
    apiKey,
    body,
  )) as ApiApproval;

  if (!approval.id) {
    throw new Error("Failed to create approval request");
  }

  console.log(`[okrunit] Approval created: ${approval.id}`);
  console.log(
    `[okrunit] Waiting for decision (timeout: ${timeout}s)...`,
  );

  // Poll for decision
  const deadline = Date.now() + timeout * 1000;
  let elapsed = 0;

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000);
    elapsed += pollInterval;

    const result = (await apiRequest(
      "GET",
      `${apiUrl}/api/v1/approvals/${approval.id}`,
      apiKey,
    )) as ApiApproval;

    if (result.status === "approved" || result.status === "rejected") {
      const approvalResult: ApprovalResult = {
        id: approval.id,
        status: result.status as "approved" | "rejected",
        decidedBy: result.decided_by_name,
        decidedAt: result.decided_at,
        comment: result.decision_comment,
      };

      if (result.status === "approved") {
        console.log(
          `[okrunit] Approved by ${result.decided_by_name ?? "unknown"}${result.decision_comment ? `: ${result.decision_comment}` : ""}`,
        );
      } else {
        console.log(
          `[okrunit] Rejected by ${result.decided_by_name ?? "unknown"}${result.decision_comment ? `: ${result.decision_comment}` : ""}`,
        );
      }

      return approvalResult;
    }

    console.log(`[okrunit] Still waiting... (${elapsed}s elapsed)`);
  }

  // Timeout
  console.log(
    `[okrunit] Approval timed out after ${timeout}s. ID: ${approval.id}`,
  );
  return {
    id: approval.id,
    status: "timeout",
  };
}
