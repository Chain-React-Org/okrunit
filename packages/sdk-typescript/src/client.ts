// ---------------------------------------------------------------------------
// OKRunit SDK -- Client
// ---------------------------------------------------------------------------

import { OKRunitError, handleErrorResponse } from "./errors";
import type {
  Approval,
  Comment,
  CreateApprovalInput,
  RespondInput,
  ListFilters,
  PaginatedResponse,
  OKRunitClientOptions,
  WaitOptions,
} from "./types";

const DEFAULT_BASE_URL = "https://app.okrunit.com";
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 3_600_000; // 1 hour

/**
 * OKRunit API client. Provides typed methods for creating, listing, and
 * responding to approval requests, as well as managing comments.
 *
 * Uses native `fetch` -- no external HTTP dependencies required.
 *
 * @example
 * ```typescript
 * import { OKRunitClient } from "@okrunit/sdk";
 *
 * const client = new OKRunitClient({ apiKey: "ok_..." });
 * const approval = await client.createApproval({ title: "Deploy to prod" });
 * const decided = await client.waitForDecision(approval.id);
 * ```
 */
export class OKRunitClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: OKRunitClientOptions) {
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  // ---- Internal helpers ---------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network request failed";
      throw new OKRunitError(message, 0, "NETWORK_ERROR");
    }

    if (!response.ok) {
      await handleErrorResponse(response);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // ---- Approvals ----------------------------------------------------------

  /**
   * Create a new approval request.
   */
  async createApproval(input: CreateApprovalInput): Promise<Approval> {
    return this.request<Approval>("POST", "/approvals", input);
  }

  /**
   * Get a single approval request by ID.
   */
  async getApproval(id: string): Promise<Approval> {
    return this.request<Approval>("GET", `/approvals/${encodeURIComponent(id)}`);
  }

  /**
   * List approval requests with optional filters and pagination.
   */
  async listApprovals(
    filters?: ListFilters,
  ): Promise<PaginatedResponse<Approval>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.page !== undefined) params.set("page", String(filters.page));
      if (filters.page_size !== undefined)
        params.set("page_size", String(filters.page_size));
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.search) params.set("search", filters.search);
    }

    const query = params.toString();
    const path = query ? `/approvals?${query}` : "/approvals";
    return this.request<PaginatedResponse<Approval>>("GET", path);
  }

  /**
   * Respond to (approve or reject) a pending approval request.
   */
  async respondToApproval(id: string, input: RespondInput): Promise<Approval> {
    return this.request<Approval>(
      "PATCH",
      `/approvals/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Cancel a pending approval request.
   */
  async cancelApproval(id: string): Promise<void> {
    await this.request<Approval>(
      "DELETE",
      `/approvals/${encodeURIComponent(id)}`,
    );
  }

  // ---- Comments -----------------------------------------------------------

  /**
   * Add a comment to an approval request.
   */
  async addComment(approvalId: string, body: string): Promise<Comment> {
    return this.request<Comment>(
      "POST",
      `/approvals/${encodeURIComponent(approvalId)}/comments`,
      { body },
    );
  }

  /**
   * List all comments on an approval request.
   */
  async listComments(approvalId: string): Promise<Comment[]> {
    const result = await this.request<{ data: Comment[] }>(
      "GET",
      `/approvals/${encodeURIComponent(approvalId)}/comments`,
    );
    return result.data;
  }

  // ---- Polling ------------------------------------------------------------

  /**
   * Wait for a decision on an approval request by polling at regular
   * intervals. Resolves when the approval leaves the `pending` status or
   * when the timeout is reached.
   *
   * @throws {OKRunitError} with code `TIMEOUT` if the timeout is exceeded.
   */
  async waitForDecision(
    id: string,
    options?: WaitOptions,
  ): Promise<Approval> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const approval = await this.getApproval(id);

      if (approval.status !== "pending") {
        return approval;
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      await this.sleep(Math.min(pollIntervalMs, remainingMs));
    }

    throw new OKRunitError(
      `Timed out waiting for decision after ${timeoutMs}ms`,
      0,
      "TIMEOUT",
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
