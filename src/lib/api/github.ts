// ---------------------------------------------------------------------------
// OKrunit -- GitHub App API Helpers
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckRunParams {
  installationId: number;
  repo: string; // "owner/repo"
  sha: string;
  status: "queued" | "in_progress" | "completed";
  conclusion?:
    | "action_required"
    | "cancelled"
    | "failure"
    | "neutral"
    | "success"
    | "skipped"
    | "stale"
    | "timed_out";
  details?: {
    title?: string;
    summary?: string;
    text?: string;
    details_url?: string;
  };
}

// ---------------------------------------------------------------------------
// JWT Generation for GitHub App Authentication
// ---------------------------------------------------------------------------

/**
 * Generate a JWT for GitHub App authentication.
 *
 * GitHub requires RS256-signed JWTs with the App ID as `iss`.
 * The token is valid for up to 10 minutes.
 */
async function generateAppJwt(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      "Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY environment variables",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued 60s in the past to account for clock drift
    exp: now + 600, // Expires in 10 minutes
    iss: appId,
  };

  // Base64url encode helper
  const base64url = (data: string): string =>
    Buffer.from(data)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  // Import the private key and sign
  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  // Replace escaped newlines from environment variable
  const formattedKey = privateKey.replace(/\\n/g, "\n");
  sign.update(signingInput);
  const signature = sign
    .sign(formattedKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// Installation Token
// ---------------------------------------------------------------------------

/**
 * Exchange a GitHub App installation ID for a short-lived installation
 * access token. Tokens are valid for 1 hour.
 */
export async function getInstallationToken(
  installationId: number,
): Promise<string> {
  const jwt = await generateAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to get installation token (${response.status}): ${body}`,
    );
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

// ---------------------------------------------------------------------------
// Check Runs
// ---------------------------------------------------------------------------

/**
 * Create or update a GitHub Check Run on a commit.
 *
 * Used to report OKrunit approval status back to a pull request.
 */
export async function createCheckRun(
  params: CheckRunParams,
): Promise<{ id: number; html_url: string }> {
  const token = await getInstallationToken(params.installationId);
  const [owner, repo] = params.repo.split("/");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com";

  const body: Record<string, unknown> = {
    name: "OKrunit Approval",
    head_sha: params.sha,
    status: params.status,
    details_url: params.details?.details_url ?? `${appUrl}/dashboard`,
  };

  if (params.conclusion) {
    body.conclusion = params.conclusion;
  }

  if (params.details) {
    body.output = {
      title: params.details.title ?? "OKrunit Approval Check",
      summary:
        params.details.summary ?? "Waiting for human approval via OKrunit.",
      text: params.details.text,
    };
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/check-runs`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create check run (${response.status}): ${errorBody}`,
    );
  }

  return (await response.json()) as { id: number; html_url: string };
}

// ---------------------------------------------------------------------------
// Webhook Signature Verification
// ---------------------------------------------------------------------------

/**
 * Verify the `X-Hub-Signature-256` header from a GitHub webhook.
 *
 * Returns `true` if the signature is valid, `false` otherwise.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("[GitHub] GITHUB_WEBHOOK_SECRET is not configured");
    return false;
  }

  if (!signature) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

  // Constant-time comparison
  if (expected.length !== signature.length) {
    return false;
  }

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);

  return timingSafeEqual(expectedBuf, signatureBuf);
}
