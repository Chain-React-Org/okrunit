// ---------------------------------------------------------------------------
// OKrunit -- Tests for Approval Response Logic (PATCH /api/v1/approvals/[id])
// ---------------------------------------------------------------------------
//
// These tests exercise the approval response handler by importing it as a
// Next.js route handler and feeding it mock Request objects. All external
// dependencies (Supabase, notifications, callbacks, etc.) are mocked.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE importing the module under test
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("@/lib/api/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/api/callbacks", () => ({
  deliverCallback: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/conditions", () => ({
  checkConditions: vi.fn().mockResolvedValue({ allMet: true }),
}));

vi.mock("@/lib/notifications/orchestrator", () => ({
  dispatchNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications/in-app", () => ({
  createInAppNotification: vi.fn().mockResolvedValue(undefined),
  createInAppNotificationBulk: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/delegation", () => ({
  findDelegationForDelegate: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/api/trust-engine", () => ({
  updateTrustCounter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api/sla", () => ({
  checkSlaBreach: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/api/geo-security", () => ({
  validateSecurityContext: vi.fn().mockReturnValue({ allowed: true, ip: "127.0.0.1", country: null }),
}));

vi.mock("@/lib/api/four-eyes", () => ({
  checkFourEyes: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock("@/lib/api/session-security", () => ({
  checkReauthRequired: vi.fn().mockReturnValue({ required: false }),
}));

vi.mock("@/lib/cache/tags", () => ({
  CacheTags: {
    requests: vi.fn().mockReturnValue("requests"),
    overview: vi.fn().mockReturnValue("overview"),
    analytics: vi.fn().mockReturnValue("analytics"),
  },
  revalidateTags: vi.fn(),
}));

// Mock next/server -- the `after` function just invokes the callback (fire-and-forget).
vi.mock("next/server", async () => {
  const { NextResponse } = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    NextResponse,
    after: vi.fn((fn: (() => Promise<void>) | Promise<void>) => {
      if (typeof fn === "function") fn().catch(() => {});
    }),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/api/auth";
import { PATCH } from "@/app/api/v1/approvals/[id]/route";

const mockedCreateAdmin = vi.mocked(createAdminClient);
const mockedAuth = vi.mocked(authenticateRequest);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-test-001";
const USER_ID = "user-approver-001";
const USER_ID_2 = "user-approver-002";
const REQUEST_ID = "req-test-001";

/** Build a minimal session auth result for the PATCH handler. */
function sessionAuth(userId = USER_ID) {
  return {
    type: "session" as const,
    orgId: ORG_ID,
    user: { id: userId },
    membership: { role: "admin", can_approve: true },
  };
}

/** Build a JSON Request for the PATCH endpoint. */
function patchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/v1/approvals/" + REQUEST_ID, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORG_SETTINGS = {
  ip_allowlist: null,
  geo_restrictions: null,
  four_eyes_config: null,
  require_reauth_for_critical: false,
  session_timeout_minutes: null,
};

/** A base pending approval record. */
function pendingApproval(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    org_id: ORG_ID,
    status: "pending",
    title: "Deploy to production",
    priority: "medium",
    required_approvals: 1,
    current_approvals: 0,
    assigned_approvers: null,
    required_role: null,
    is_sequential: false,
    expires_at: null,
    auto_action: null,
    auto_action_deadline: null,
    callback_url: null,
    callback_headers: null,
    connection_id: null,
    action_type: null,
    source: null,
    metadata: null,
    decided_by: null,
    decided_at: null,
    decision_comment: null,
    require_rejection_reason: false,
    conditions_met: true,
    execution_status: null,
    scheduled_execution_at: null,
    created_by: null,
    sla_breached: false,
    sla_deadline: null,
    ...overrides,
  };
}

/**
 * Create a sequencing mock Supabase client.
 *
 * The handler calls `from("approval_requests")` multiple times:
 *   1st: to fetch the approval (via .select().eq().eq().single())
 *   2nd: to update the approval (via .update().eq().select().single())
 *   3rd+: fire-and-forget side effects (notifications marking, etc.)
 *
 * This helper lets you specify a sequence of results per table.
 */
function createSequencingMockClient(
  tableSequences: Record<string, Array<{ data: unknown; error?: { message: string; code?: string } | null; count?: number | null }>>,
) {
  const callCounts: Record<string, number> = {};

  // Build a proxy that is chainable for all Supabase methods
  function buildChainProxy(result: { data: unknown; error: { message: string; code?: string } | null; count: number | null }) {
    const proxy: Record<string, unknown> = {};
    const methods = [
      "select", "insert", "update", "delete", "upsert",
      "eq", "neq", "gt", "gte", "lt", "lte", "in", "is",
      "like", "ilike", "match", "not", "or", "filter",
      "order", "limit", "range",
    ];

    for (const m of methods) {
      proxy[m] = vi.fn().mockReturnValue(proxy);
    }

    // single/maybeSingle resolve the result
    proxy["single"] = vi.fn().mockResolvedValue(result);
    proxy["maybeSingle"] = vi.fn().mockResolvedValue(result);

    // Allow await on the proxy directly
    proxy["then"] = (
      resolve: (v: typeof result) => void,
      reject: (e: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject);

    return proxy;
  }

  const mockClient: Record<string, unknown> = {
    from: vi.fn((table: string) => {
      if (!callCounts[table]) callCounts[table] = 0;
      const seq = tableSequences[table];
      const idx = callCounts[table];
      callCounts[table]++;

      if (seq && idx < seq.length) {
        const entry = seq[idx];
        return buildChainProxy({
          data: entry.data,
          error: entry.error ?? null,
          count: entry.count ?? null,
        });
      }
      // Default: return a proxy with null data
      return buildChainProxy({ data: null, error: null, count: null });
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    },
  };

  return mockClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Approval respond handler (PATCH)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================================================================
  // 1. Basic approval lifecycle
  // =====================================================================

  describe("approval lifecycle", () => {
    it("approves a pending request and returns the updated record", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const updatedRecord = pendingApproval({ status: "approved", decided_by: USER_ID });

      const mockClient = createSequencingMockClient({
        // 1st call: fetch org settings
        organizations: [{ data: ORG_SETTINGS }],
        // approval_requests calls in order:
        // 1st: fetchApproval (returns pending)
        // 2nd: checkAndExpire update (skipped since no expires_at, but the code calls update on the same from chain)
        // Actually, let's trace the exact calls:
        // - fetchApproval: from("approval_requests").select("*").eq("id",id).eq("org_id",orgId).single()
        // - update: from("approval_requests").update(...).eq("id",id).select("*").single()
        // - from("organizations").select("rejection_reason_policy")... (only for reject, not approve)
        approval_requests: [
          { data: pendingApproval() },     // fetchApproval
          { data: updatedRecord },          // update
        ],
        user_profiles: [{ data: { full_name: "Test User", email: "test@example.com" } }],
        org_memberships: [{ data: [] }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("approved");
    });

    it("rejects a pending request and returns the updated record", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const updatedRecord = pendingApproval({ status: "rejected", decided_by: USER_ID });

      const mockClient = createSequencingMockClient({
        organizations: [
          { data: ORG_SETTINGS },
          // 2nd org call: rejection_reason_policy check
          { data: { rejection_reason_policy: "optional" } },
        ],
        approval_requests: [
          { data: pendingApproval() },     // fetchApproval
          { data: updatedRecord },          // update
        ],
        user_profiles: [{ data: { full_name: "Test User", email: "test@example.com" } }],
        org_memberships: [{ data: [] }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "reject", comment: "Not ready yet" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("rejected");
    });

    it("rejects approval attempt on an already-approved request (409)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ status: "approved" }) },  // fetchApproval returns non-pending
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("NOT_PENDING");
    });

    it("rejects approval attempt on an already-rejected request (409)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ status: "rejected" }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("NOT_PENDING");
    });

    it("rejects approval attempt on a cancelled request (409)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ status: "cancelled" }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("NOT_PENDING");
    });
  });

  // =====================================================================
  // 2. Expired request handling
  // =====================================================================

  describe("expired request handling", () => {
    it("rejects approval of a request with expires_at in the past (409 EXPIRED)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const pastDate = new Date(Date.now() - 60_000).toISOString();

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ expires_at: pastDate }) },  // fetchApproval
          { data: null },  // checkAndExpire update
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("EXPIRED");
    });

    it("rejects rejection of a request with expires_at in the past (409 EXPIRED)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const pastDate = new Date(Date.now() - 60_000).toISOString();

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ expires_at: pastDate }) },
          { data: null },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "reject" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("EXPIRED");
    });

    it("allows approval of a request with expires_at in the future", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const futureDate = new Date(Date.now() + 3_600_000).toISOString();
      const updatedRecord = pendingApproval({ status: "approved", expires_at: futureDate, decided_by: USER_ID });

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ expires_at: futureDate }) },  // fetchApproval
          { data: updatedRecord },  // update
        ],
        user_profiles: [{ data: { full_name: "Test User", email: "test@example.com" } }],
        org_memberships: [{ data: [] }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("approved");
    });
  });

  // =====================================================================
  // 3. Auto-action deadline handling
  // =====================================================================

  describe("auto-action deadline handling", () => {
    it("rejects manual approval when auto-action deadline has passed (409 AUTO_ACTIONED)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const pastDeadline = new Date(Date.now() - 60_000).toISOString();

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ auto_action: "approve", auto_action_deadline: pastDeadline }) },
          { data: null },  // checkAndApplyAutoAction update
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("AUTO_ACTIONED");
    });
  });

  // =====================================================================
  // 4. Multi-approval requirements
  // =====================================================================

  describe("multi-approval requirements", () => {
    it("keeps request pending when approval threshold is not yet met", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const approval = pendingApproval({
        required_approvals: 3,
        current_approvals: 0,
      });

      const updatedAfterVote = {
        ...approval,
        current_approvals: 1,
        status: "pending",
      };

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: approval },        // fetchApproval
          { data: updatedAfterVote }, // update (after vote insert)
        ],
        // approval_votes: first call checks for existing vote (maybeSingle), second inserts
        approval_votes: [
          { data: null },  // no existing vote
          { data: null },  // insert succeeds (no error)
        ],
        in_app_notifications: [{ data: null }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("pending");
      expect(body.current_approvals).toBe(1);
    });

    it("finalizes request when approval threshold is met", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const approval = pendingApproval({
        required_approvals: 2,
        current_approvals: 1,
      });

      const updatedAfterVote = {
        ...approval,
        current_approvals: 2,
        status: "approved",
        decided_by: USER_ID,
      };

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: approval },
          { data: updatedAfterVote },
        ],
        approval_votes: [
          { data: null },  // no existing vote
          { data: null },  // insert
        ],
        user_profiles: [{ data: { full_name: "Test User", email: "test@example.com" } }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("approved");
      expect(body.current_approvals).toBe(2);
    });

    it("immediately rejects multi-approver request on any rejection", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const approval = pendingApproval({
        required_approvals: 3,
        current_approvals: 1,
      });

      const updatedAfterReject = {
        ...approval,
        status: "rejected",
        decided_by: USER_ID,
      };

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: approval },
          { data: updatedAfterReject },
        ],
        approval_votes: [
          { data: null },  // no existing vote
          { data: null },  // insert
        ],
        user_profiles: [{ data: { full_name: "Test User", email: "test@example.com" } }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "reject", comment: "Blocking issue found" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("rejected");
    });

    it("prevents duplicate votes from the same user (409 DUPLICATE_VOTE)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const approval = pendingApproval({
        required_approvals: 3,
        current_approvals: 1,
      });

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: approval },
        ],
        // Existing vote found for this user
        approval_votes: [
          { data: { id: "vote-existing" } },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("DUPLICATE_VOTE");
    });
  });

  // =====================================================================
  // 5. Concurrent approval race conditions
  // =====================================================================

  describe("concurrent approval race conditions", () => {
    it("only one of two concurrent approvers succeeds on a single-approver request", async () => {
      // First user: sees pending, approves successfully
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID));

      const mockClient1 = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval() },  // fetchApproval returns pending
          { data: pendingApproval({ status: "approved", decided_by: USER_ID }) },  // update
        ],
        user_profiles: [{ data: { full_name: "User One", email: "u1@test.com" } }],
        org_memberships: [{ data: [] }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient1 as ReturnType<typeof createAdminClient>);

      const request1 = patchRequest({ decision: "approve" });
      const response1 = await PATCH(request1, { params: Promise.resolve({ id: REQUEST_ID }) });
      expect(response1.status).toBe(200);
      const body1 = await response1.json();
      expect(body1.status).toBe("approved");

      // Second user: sees approved (already decided), gets 409
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID_2));

      const mockClient2 = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ status: "approved", decided_by: USER_ID }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient2 as ReturnType<typeof createAdminClient>);

      const request2 = patchRequest({ decision: "approve" });
      const response2 = await PATCH(request2, { params: Promise.resolve({ id: REQUEST_ID }) });
      expect(response2.status).toBe(409);
      const body2 = await response2.json();
      expect(body2.code).toBe("NOT_PENDING");
    });

    it("prevents approving after another user has rejected", async () => {
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID));

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ status: "rejected", decided_by: USER_ID_2 }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("NOT_PENDING");
    });

    it("prevents rejecting after another user has approved", async () => {
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID));

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ status: "approved", decided_by: USER_ID_2 }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "reject" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("NOT_PENDING");
    });

    it("prevents concurrent multi-approval votes from the same user via DB unique constraint", async () => {
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID));

      const approval = pendingApproval({
        required_approvals: 3,
        current_approvals: 1,
      });

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [{ data: approval }],
        // First call: maybeSingle returns null (no existing vote),
        // Second call: insert fails with unique constraint violation
        approval_votes: [
          { data: null },
          { data: null, error: { message: "duplicate key", code: "23505" } },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("DUPLICATE_VOTE");
    });
  });

  // =====================================================================
  // 6. Auth and permission checks
  // =====================================================================

  describe("auth and permission checks", () => {
    it("rejects non-session auth (API key) with 403 SESSION_REQUIRED", async () => {
      mockedAuth.mockResolvedValue({
        type: "api_key" as const,
        orgId: ORG_ID,
        connection: { id: "conn-1", name: "Test", rate_limit_per_hour: 100, created_by: USER_ID },
      } as Awaited<ReturnType<typeof authenticateRequest>>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("SESSION_REQUIRED");
    });

    it("rejects users without can_approve permission (403 NOT_APPROVER)", async () => {
      mockedAuth.mockResolvedValue({
        type: "session" as const,
        orgId: ORG_ID,
        user: { id: USER_ID },
        membership: { role: "member", can_approve: false },
      } as Awaited<ReturnType<typeof authenticateRequest>>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("NOT_APPROVER");
    });

    it("returns 404 when approval request is not found", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: null, error: { message: "not found" } },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: "non-existent" }) });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  // =====================================================================
  // 7. Validation errors
  // =====================================================================

  describe("validation errors", () => {
    it("returns 400 for invalid decision value", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const request = patchRequest({ decision: "maybe" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(400);
    });

    it("returns 400 for missing decision field", async () => {
      mockedAuth.mockResolvedValue(sessionAuth());

      const request = patchRequest({});
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(400);
    });
  });

  // =====================================================================
  // 8. Assigned approvers enforcement
  // =====================================================================

  describe("assigned approvers enforcement", () => {
    it("rejects approval from a non-assigned user (403 NOT_ASSIGNED_APPROVER)", async () => {
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID));

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ assigned_approvers: [USER_ID_2] }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const { findDelegationForDelegate } = await import("@/lib/api/delegation");
      vi.mocked(findDelegationForDelegate).mockResolvedValue(null);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("NOT_ASSIGNED_APPROVER");
    });

    it("allows approval from an assigned user", async () => {
      mockedAuth.mockResolvedValue(sessionAuth(USER_ID));

      const updatedRecord = pendingApproval({
        status: "approved",
        assigned_approvers: [USER_ID],
        decided_by: USER_ID,
      });

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ assigned_approvers: [USER_ID] }) },  // fetchApproval
          { data: updatedRecord },  // update
        ],
        user_profiles: [{ data: { full_name: "Test User", email: "test@example.com" } }],
        org_memberships: [{ data: [] }],
        in_app_notifications: [{ data: null }],
        request_watchers: [{ data: [] }],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("approved");
    });
  });

  // =====================================================================
  // 9. Role-based access control
  // =====================================================================

  describe("role-based access control", () => {
    it("rejects approval when user role is below required_role (403 INSUFFICIENT_ROLE)", async () => {
      mockedAuth.mockResolvedValue({
        type: "session" as const,
        orgId: ORG_ID,
        user: { id: USER_ID },
        membership: { role: "member", can_approve: true },
      } as Awaited<ReturnType<typeof authenticateRequest>>);

      const mockClient = createSequencingMockClient({
        organizations: [{ data: ORG_SETTINGS }],
        approval_requests: [
          { data: pendingApproval({ required_role: "admin" }) },
        ],
      });

      mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

      const request = patchRequest({ decision: "approve" });
      const response = await PATCH(request, { params: Promise.resolve({ id: REQUEST_ID }) });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("INSUFFICIENT_ROLE");
    });
  });
});
