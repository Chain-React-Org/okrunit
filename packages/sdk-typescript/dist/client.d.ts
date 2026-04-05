import type { Approval, Comment, CreateApprovalInput, RespondInput, ListFilters, PaginatedResponse, OKRunitClientOptions, WaitOptions } from "./types";
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
export declare class OKRunitClient {
    private readonly apiKey;
    private readonly baseUrl;
    constructor(options: OKRunitClientOptions);
    private request;
    /**
     * Create a new approval request.
     */
    createApproval(input: CreateApprovalInput): Promise<Approval>;
    /**
     * Get a single approval request by ID.
     */
    getApproval(id: string): Promise<Approval>;
    /**
     * List approval requests with optional filters and pagination.
     */
    listApprovals(filters?: ListFilters): Promise<PaginatedResponse<Approval>>;
    /**
     * Respond to (approve or reject) a pending approval request.
     */
    respondToApproval(id: string, input: RespondInput): Promise<Approval>;
    /**
     * Cancel a pending approval request.
     */
    cancelApproval(id: string): Promise<void>;
    /**
     * Add a comment to an approval request.
     */
    addComment(approvalId: string, body: string): Promise<Comment>;
    /**
     * List all comments on an approval request.
     */
    listComments(approvalId: string): Promise<Comment[]>;
    /**
     * Wait for a decision on an approval request by polling at regular
     * intervals. Resolves when the approval leaves the `pending` status or
     * when the timeout is reached.
     *
     * @throws {OKRunitError} with code `TIMEOUT` if the timeout is exceeded.
     */
    waitForDecision(id: string, options?: WaitOptions): Promise<Approval>;
    private sleep;
}
//# sourceMappingURL=client.d.ts.map