/**
 * OKRunit Approval Gate -- Netlify Build Plugin
 *
 * Pauses the Netlify build process until a human approves the deployment
 * in OKRunit. Rejects or timeouts cause the build to fail.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetlifyPluginInputs {
  api_key?: string;
  api_url?: string;
  title?: string;
  description?: string;
  priority?: string;
  timeout?: number | string;
  poll_interval?: number | string;
  branches?: string;
}

interface NetlifyUtils {
  build: {
    failBuild: (message: string) => never;
    failPlugin: (message: string) => void;
    cancelBuild: (message: string) => void;
  };
  status: {
    show: (options: { title?: string; summary: string; text?: string }) => void;
  };
}

interface NetlifyConstants {
  SITE_ID?: string;
  IS_LOCAL?: boolean;
  NETLIFY_BUILD_VERSION?: string;
}

interface NetlifyPluginArgs {
  inputs: NetlifyPluginInputs;
  utils: NetlifyUtils;
  constants: NetlifyConstants;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Collect Netlify deployment context from environment variables.
 */
function getNetlifyContext(): Record<string, string> {
  const env = process.env;
  const context: Record<string, string> = {};

  const vars: Record<string, string | undefined> = {
    site_name: env.SITE_NAME,
    site_id: env.SITE_ID,
    branch: env.BRANCH,
    head: env.HEAD,
    commit_ref: env.COMMIT_REF,
    context: env.CONTEXT,
    deploy_url: env.DEPLOY_URL,
    deploy_prime_url: env.DEPLOY_PRIME_URL,
    deploy_id: env.DEPLOY_ID,
    build_id: env.BUILD_ID,
    url: env.URL,
    repository_url: env.REPOSITORY_URL,
    pull_request: env.PULL_REQUEST,
    review_id: env.REVIEW_ID,
  };

  for (const [key, value] of Object.entries(vars)) {
    if (value) {
      context[key] = value;
    }
  }

  return context;
}

function generateIdempotencyKey(netlifyContext: Record<string, string>): string {
  const buildId = netlifyContext.build_id ?? netlifyContext.deploy_id;
  const commitRef = netlifyContext.commit_ref;

  if (buildId) {
    return `netlify-${buildId}-${commitRef ?? Date.now()}`;
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `netlify-${timestamp}-${random}`;
}

// ---------------------------------------------------------------------------
// Core: requestApproval (usable standalone outside the plugin)
// ---------------------------------------------------------------------------

/**
 * Request human approval before proceeding with a Netlify deployment.
 *
 * Creates an approval request in OKRunit, then polls until the request
 * is approved, rejected, or times out.
 *
 * @example
 * ```ts
 * import { requestApproval } from "@okrunit/netlify";
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

  const netlifyContext = getNetlifyContext();
  const siteName = netlifyContext.site_name ?? "unknown";
  const branch = netlifyContext.branch ?? netlifyContext.head ?? "unknown";
  const deployContext = netlifyContext.context ?? "unknown";

  const title =
    options.title ??
    `Netlify deployment approval: ${siteName} (${branch} -> ${deployContext})`;

  const description =
    options.description ??
    (netlifyContext.commit_ref
      ? `Deploying commit ${netlifyContext.commit_ref.substring(0, 8)} to ${deployContext}`
      : undefined);

  const idempotencyKey = generateIdempotencyKey(netlifyContext);

  const metadata: Record<string, unknown> = {
    ...netlifyContext,
    ...(options.metadata ?? {}),
  };

  // Create approval request
  const body: Record<string, unknown> = {
    title,
    source: "netlify",
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

// ---------------------------------------------------------------------------
// Netlify Build Plugin
// ---------------------------------------------------------------------------

const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export default function okrunitPlugin() {
  return {
    onPreBuild: async ({ inputs, utils, constants }: NetlifyPluginArgs) => {
      const apiKey =
        inputs.api_key ?? process.env.OKRUNIT_API_KEY;

      if (!apiKey) {
        utils.build.failPlugin(
          "OKRunit: Missing API key. Set OKRUNIT_API_KEY env var or api_key plugin input.",
        );
        return;
      }

      // Branch filtering: skip approval if current branch is not in the list
      if (inputs.branches) {
        const allowedBranches = inputs.branches
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean);
        const currentBranch =
          process.env.BRANCH ?? process.env.HEAD ?? "";

        if (
          allowedBranches.length > 0 &&
          !allowedBranches.includes(currentBranch)
        ) {
          console.log(
            `[okrunit] Skipping approval: branch "${currentBranch}" not in [${allowedBranches.join(", ")}]`,
          );
          return;
        }
      }

      const priority = inputs.priority ?? "medium";
      if (
        !VALID_PRIORITIES.includes(
          priority as (typeof VALID_PRIORITIES)[number],
        )
      ) {
        utils.build.failBuild(
          `OKRunit: Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(", ")}`,
        );
      }

      const timeout =
        typeof inputs.timeout === "string"
          ? parseInt(inputs.timeout, 10)
          : inputs.timeout ?? 3600;
      const pollInterval =
        typeof inputs.poll_interval === "string"
          ? parseInt(inputs.poll_interval, 10)
          : inputs.poll_interval ?? 10;

      try {
        const result = await requestApproval({
          apiKey,
          apiUrl: inputs.api_url,
          title: inputs.title,
          description: inputs.description,
          priority: priority as "low" | "medium" | "high" | "critical",
          timeout,
          pollInterval,
          metadata: {
            netlify_local: constants.IS_LOCAL ?? false,
            netlify_site_id: constants.SITE_ID,
          },
        });

        if (result.status === "approved") {
          utils.status.show({
            title: "OKRunit Approval",
            summary: `Approved by ${result.decidedBy ?? "unknown"}`,
            text: result.comment ?? undefined,
          });
          return;
        }

        if (result.status === "rejected") {
          utils.build.failBuild(
            `OKRunit: Deployment rejected${result.decidedBy ? ` by ${result.decidedBy}` : ""}${result.comment ? `: ${result.comment}` : ""}`,
          );
        }

        // Timeout
        utils.build.failBuild(
          `OKRunit: Approval timed out after ${timeout}s. Approval ID: ${result.id}`,
        );
      } catch (err) {
        utils.build.failBuild(
          `OKRunit: ${err instanceof Error ? err.message : "Unexpected error"}`,
        );
      }
    },
  };
}
