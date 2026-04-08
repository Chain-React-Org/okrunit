// ---------------------------------------------------------------------------
// OKrunit -- Tests for Trust Engine
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase admin client mock -------------------------------------------

const mockInsertResult = { data: null, error: null };
const mockUpdateChain = {
  eq: vi.fn().mockReturnThis(),
  then: (resolve: (v: unknown) => void) => resolve(mockInsertResult),
};
const mockUpdate = vi.fn().mockReturnValue(mockUpdateChain);

let mockSelectData: unknown[] | null = null;
let mockSelectError: { message: string } | null = null;

const mockOrder = vi.fn().mockImplementation(() => ({
  data: mockSelectData,
  error: mockSelectError,
  then: (resolve: (v: unknown) => void) =>
    resolve({ data: mockSelectData, error: mockSelectError }),
}));

const mockEqChain: Record<string, unknown> = {};
mockEqChain.eq = vi.fn().mockReturnValue(mockEqChain);
mockEqChain.order = mockOrder;
mockEqChain.data = null;
mockEqChain.error = null;

// Make the eq chain also act as a thenable that resolves with data
Object.defineProperty(mockEqChain, "then", {
  value: (resolve: (v: unknown) => void) =>
    resolve({ data: mockSelectData, error: mockSelectError }),
  configurable: true,
});

const mockSelect = vi.fn().mockReturnValue(mockEqChain);
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  update: mockUpdate,
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import {
  checkTrustThreshold,
  updateTrustCounter,
  type TrustCounter,
  type TrustCheckResult,
} from "../trust-engine";

// ---- Helpers ----------------------------------------------------------------

function makeTrustCounter(overrides: Partial<TrustCounter> = {}): TrustCounter {
  return {
    id: "counter-1",
    org_id: "org-1",
    match_field: "action_type",
    match_value: "deploy",
    consecutive_approvals: 10,
    total_approvals: 50,
    total_rejections: 2,
    last_decision: "approved",
    last_decision_at: "2026-04-01T12:00:00Z",
    auto_approve_threshold: 5,
    auto_approve_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-04-01T12:00:00Z",
    ...overrides,
  };
}

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectData = null;
  mockSelectError = null;
});

// ---- checkTrustThreshold ----------------------------------------------------

describe("checkTrustThreshold", () => {
  it("returns autoApprove=true when an active counter matches by action_type", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "action_type",
        match_value: "deploy",
        consecutive_approvals: 10,
        auto_approve_threshold: 5,
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      action_type: "deploy",
    });

    expect(result.autoApprove).toBe(true);
    expect(result.counterId).toBe("counter-1");
    expect(result.reason).toContain("Trust threshold met");
  });

  it("returns autoApprove=false when no counters exist", async () => {
    mockSelectData = [];

    const result = await checkTrustThreshold("org-1", {
      action_type: "deploy",
    });

    expect(result.autoApprove).toBe(false);
    expect(result.counterId).toBeNull();
  });

  it("returns autoApprove=false when counters exist but none match", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "action_type",
        match_value: "deploy",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      action_type: "build", // Does not match "deploy"
    });

    expect(result.autoApprove).toBe(false);
  });

  it("returns autoApprove=false on database error", async () => {
    mockSelectError = { message: "Database connection failed" };
    mockSelectData = null;

    const result = await checkTrustThreshold("org-1", {
      action_type: "deploy",
    });

    expect(result.autoApprove).toBe(false);
    expect(result.counterId).toBeNull();
  });

  it("matches by source field", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "source",
        match_value: "zapier",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      source: "zapier",
    });

    expect(result.autoApprove).toBe(true);
  });

  it("matches by title_pattern using regex", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "title_pattern",
        match_value: "^Deploy.*prod",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      title: "Deploy v2.0 to prod",
    });

    expect(result.autoApprove).toBe(true);
  });

  it("does not match title_pattern when title does not match regex", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "title_pattern",
        match_value: "^Deploy.*prod",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      title: "Build staging environment",
    });

    expect(result.autoApprove).toBe(false);
  });

  it("handles invalid regex in title_pattern gracefully (no match)", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "title_pattern",
        match_value: "[invalid regex",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      title: "Some title",
    });

    expect(result.autoApprove).toBe(false);
  });

  it("matches by connection_id", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "connection_id",
        match_value: "conn-abc-123",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      connection_id: "conn-abc-123",
    });

    expect(result.autoApprove).toBe(true);
  });

  it("returns first matching counter when multiple match", async () => {
    mockSelectData = [
      makeTrustCounter({
        id: "counter-first",
        match_field: "action_type",
        match_value: "deploy",
        auto_approve_active: true,
      }),
      makeTrustCounter({
        id: "counter-second",
        match_field: "source",
        match_value: "github",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      action_type: "deploy",
      source: "github",
    });

    expect(result.autoApprove).toBe(true);
    expect(result.counterId).toBe("counter-first");
  });

  it("does not match counters with unknown match_field", async () => {
    mockSelectData = [
      makeTrustCounter({
        match_field: "unknown_field" as string,
        match_value: "anything",
        auto_approve_active: true,
      }),
    ];

    const result = await checkTrustThreshold("org-1", {
      action_type: "deploy",
    });

    expect(result.autoApprove).toBe(false);
  });
});

// ---- Trust score from counters (conceptual) ---------------------------------

describe("trust score calculation from counters", () => {
  it("counter with high consecutive approvals indicates high trust", () => {
    const counter = makeTrustCounter({
      consecutive_approvals: 50,
      total_approvals: 100,
      total_rejections: 1,
      auto_approve_threshold: 10,
      auto_approve_active: true,
    });

    // The trust engine considers a counter "trusted" when
    // consecutive_approvals >= auto_approve_threshold
    const isTrusted =
      counter.auto_approve_threshold !== null &&
      counter.consecutive_approvals >= counter.auto_approve_threshold &&
      counter.auto_approve_active;

    expect(isTrusted).toBe(true);
  });

  it("counter with low consecutive approvals is not auto-approved", () => {
    const counter = makeTrustCounter({
      consecutive_approvals: 2,
      total_approvals: 10,
      total_rejections: 5,
      auto_approve_threshold: 10,
      auto_approve_active: false,
    });

    const isTrusted =
      counter.auto_approve_threshold !== null &&
      counter.consecutive_approvals >= counter.auto_approve_threshold &&
      counter.auto_approve_active;

    expect(isTrusted).toBe(false);
  });

  it("counter with null threshold is never auto-approved", () => {
    const counter = makeTrustCounter({
      consecutive_approvals: 100,
      auto_approve_threshold: null,
      auto_approve_active: true,
    });

    const isTrusted =
      counter.auto_approve_threshold !== null &&
      counter.consecutive_approvals >= counter.auto_approve_threshold &&
      counter.auto_approve_active;

    expect(isTrusted).toBe(false);
  });
});
