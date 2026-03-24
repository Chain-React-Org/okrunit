import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__mocks__/supabase";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  activateFirstStep,
  recordStepVote,
  getRequestSteps,
} from "@/lib/approvals/steps-engine";

const mockedCreateAdmin = vi.mocked(createAdminClient);

// Helpers for building step fixtures
function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: "step-1",
    request_id: "req-1",
    step_order: 1,
    name: "Manager Approval",
    status: "active",
    assigned_team_id: null,
    assigned_user_ids: null,
    assigned_role: null,
    required_approvals: 2,
    current_approvals: 0,
    timeout_minutes: null,
    activated_at: null,
    completed_at: null,
    decided_by: null,
    decision_comment: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("activateFirstStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates step_order=1 for the given request", async () => {
    const { mockClient, mockTableResults, chainable } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: makeStep({ status: "pending" }) },
      approval_requests: { data: null },
    });

    await activateFirstStep("req-1");

    // Should have called update on approval_steps and approval_requests
    expect(chainable.update).toHaveBeenCalled();
    expect(chainable.eq).toHaveBeenCalled();
  });

  it("does nothing if no first step exists", async () => {
    const { mockClient, mockTableResults, chainable } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: null },
    });

    await activateFirstStep("req-1");

    // update should not have been called beyond the initial query chain
    // The function returns early if firstStep is null
    expect(chainable.update).not.toHaveBeenCalled();
  });
});

describe("recordStepVote — approve (not reaching threshold)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments approval counter without completing step", async () => {
    const { mockClient, mockTableResults, chainable } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

    // Step requires 3 approvals, currently has 1
    const step = makeStep({
      required_approvals: 3,
      current_approvals: 1,
      assigned_user_ids: ["user-1", "user-2", "user-3"],
    });

    mockTableResults({
      approval_steps: { data: step },
      step_votes: { data: null },
    });

    const result = await recordStepVote("step-1", "req-1", "user-1", "approve");

    expect(result.stepComplete).toBe(false);
    expect(result.stepApproved).toBe(false);
    expect(result.allStepsComplete).toBe(false);
    expect(result.requestApproved).toBe(false);
    expect(result.nextStep).toBeNull();
    expect(chainable.insert).toHaveBeenCalled();
  });
});

describe("recordStepVote — approve reaching threshold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes step and activates next step when threshold reached", async () => {
    const step = makeStep({
      required_approvals: 2,
      current_approvals: 1,
      assigned_user_ids: ["user-1", "user-2"],
    });
    const nextStep = makeStep({
      id: "step-2",
      step_order: 2,
      name: "VP Approval",
      status: "pending",
    });

    const { mockClient, chainable } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

    // Control what `from` returns based on calls
    let fromCallCount = 0;
    let pendingResult = { data: null, error: null, count: null };

    const proxy: Record<string, unknown> = {};
    const methods = [
      "select", "insert", "update", "delete", "eq", "neq",
      "gt", "gte", "lt", "lte", "in", "is", "like", "ilike",
      "match", "not", "or", "filter", "order", "limit", "range",
      "single", "maybeSingle",
    ];

    for (const method of methods) {
      proxy[method] = vi.fn().mockImplementation(() => {
        if (method === "single" || method === "maybeSingle") {
          return Promise.resolve(pendingResult);
        }
        return proxy;
      });
    }
    proxy["then"] = (
      resolve: (v: unknown) => void,
      reject: (e: unknown) => void,
    ) => Promise.resolve(pendingResult).then(resolve, reject);

    (proxy as Record<string, ReturnType<typeof vi.fn>>)["from"] = vi.fn().mockImplementation((table: string) => {
      fromCallCount++;
      if (table === "approval_steps") {
        // First call: get step. Third call: get next step.
        if (fromCallCount === 1) {
          pendingResult = { data: step, error: null, count: null };
        } else {
          pendingResult = { data: nextStep, error: null, count: null };
        }
      } else {
        pendingResult = { data: null, error: null, count: null };
      }
      return proxy;
    });

    mockedCreateAdmin.mockReturnValue(proxy as ReturnType<typeof createAdminClient>);

    const result = await recordStepVote("step-1", "req-1", "user-1", "approve");

    expect(result.stepComplete).toBe(true);
    expect(result.stepApproved).toBe(true);
    expect(result.allStepsComplete).toBe(false);
    expect(result.requestApproved).toBe(false);
    expect(result.nextStep).toBeTruthy();
    expect(result.nextStep?.id).toBe("step-2");
  });
});

describe("recordStepVote — reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects step and entire request", async () => {
    const step = makeStep({
      assigned_user_ids: ["user-1"],
    });

    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: step },
      step_votes: { data: null },
      approval_requests: { data: null },
    });

    const result = await recordStepVote("step-1", "req-1", "user-1", "reject", "Not appropriate");

    expect(result.stepComplete).toBe(true);
    expect(result.stepApproved).toBe(false);
    expect(result.allStepsComplete).toBe(true);
    expect(result.requestApproved).toBe(false);
    expect(result.nextStep).toBeNull();
  });
});

describe("recordStepVote — last step approved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves entire request when last step is approved", async () => {
    const step = makeStep({
      required_approvals: 1,
      current_approvals: 0,
      step_order: 2,
      assigned_user_ids: ["user-1"],
    });

    let fromCallCount = 0;
    let pendingResult: { data: unknown; error: null; count: null } = { data: null, error: null, count: null };

    const proxy: Record<string, unknown> = {};
    const methods = [
      "select", "insert", "update", "delete", "eq", "neq",
      "gt", "gte", "lt", "lte", "in", "is", "like", "ilike",
      "match", "not", "or", "filter", "order", "limit", "range",
      "single", "maybeSingle",
    ];

    for (const method of methods) {
      proxy[method] = vi.fn().mockImplementation(() => {
        if (method === "single" || method === "maybeSingle") {
          return Promise.resolve(pendingResult);
        }
        return proxy;
      });
    }
    proxy["then"] = (
      resolve: (v: unknown) => void,
      reject: (e: unknown) => void,
    ) => Promise.resolve(pendingResult).then(resolve, reject);

    (proxy as Record<string, ReturnType<typeof vi.fn>>)["from"] = vi.fn().mockImplementation((table: string) => {
      fromCallCount++;
      if (table === "approval_steps" && fromCallCount === 1) {
        // First: get the step
        pendingResult = { data: step, error: null, count: null };
      } else if (table === "approval_steps") {
        // Looking for next step: none (null data)
        pendingResult = { data: null, error: null, count: null };
      } else {
        pendingResult = { data: null, error: null, count: null };
      }
      return proxy;
    });

    mockedCreateAdmin.mockReturnValue(proxy as ReturnType<typeof createAdminClient>);

    const result = await recordStepVote("step-1", "req-1", "user-1", "approve");

    expect(result.stepComplete).toBe(true);
    expect(result.stepApproved).toBe(true);
    expect(result.allStepsComplete).toBe(true);
    expect(result.requestApproved).toBe(true);
    expect(result.nextStep).toBeNull();
  });
});

describe("recordStepVote — authorization checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when step is not active", async () => {
    const step = makeStep({ status: "pending" });
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: step },
    });

    await expect(
      recordStepVote("step-1", "req-1", "user-1", "approve"),
    ).rejects.toThrow("Step is not active");
  });

  it("throws when user is not in assigned_user_ids", async () => {
    const step = makeStep({
      assigned_user_ids: ["user-2", "user-3"],
    });
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: step },
    });

    await expect(
      recordStepVote("step-1", "req-1", "user-1", "approve"),
    ).rejects.toThrow("not authorized");
  });

  it("allows when user is in assigned_user_ids", async () => {
    const step = makeStep({
      required_approvals: 3,
      current_approvals: 0,
      assigned_user_ids: ["user-1", "user-2"],
    });
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: step },
      step_votes: { data: null },
    });

    const result = await recordStepVote("step-1", "req-1", "user-1", "approve");
    expect(result.stepComplete).toBe(false);
  });

  it("checks team membership when assigned_team_id is set", async () => {
    const step = makeStep({
      required_approvals: 3,
      current_approvals: 0,
      assigned_team_id: "team-1",
      assigned_user_ids: null,
    });

    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: step },
      team_memberships: { count: 1, data: null },
      step_votes: { data: null },
    });

    const result = await recordStepVote("step-1", "req-1", "user-1", "approve");
    expect(result.stepComplete).toBe(false);
  });

  it("rejects when user is not a team member", async () => {
    const step = makeStep({
      assigned_team_id: "team-1",
      assigned_user_ids: null,
    });

    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: step },
      team_memberships: { count: 0, data: null },
    });

    await expect(
      recordStepVote("step-1", "req-1", "user-1", "approve"),
    ).rejects.toThrow("not authorized");
  });
});

describe("getRequestSteps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no steps exist", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      approval_steps: { data: null },
    });

    const result = await getRequestSteps("req-1");
    expect(result).toEqual([]);
  });

  it("returns steps with votes grouped by step", async () => {
    const steps = [
      makeStep({ id: "step-1", step_order: 1 }),
      makeStep({ id: "step-2", step_order: 2 }),
    ];
    const votes = [
      { id: "v1", step_id: "step-1", request_id: "req-1", user_id: "u1", vote: "approve", created_at: "2026-01-01" },
      { id: "v2", step_id: "step-1", request_id: "req-1", user_id: "u2", vote: "approve", created_at: "2026-01-02" },
    ];

    let fromCallCount = 0;
    let pendingResult: { data: unknown; error: null; count: null } = { data: null, error: null, count: null };

    const proxy: Record<string, unknown> = {};
    const methods = [
      "select", "insert", "update", "delete", "eq", "neq",
      "gt", "gte", "lt", "lte", "in", "is", "like", "ilike",
      "match", "not", "or", "filter", "order", "limit", "range",
      "single", "maybeSingle",
    ];
    for (const method of methods) {
      proxy[method] = vi.fn().mockImplementation(() => {
        if (method === "single" || method === "maybeSingle") {
          return Promise.resolve(pendingResult);
        }
        return proxy;
      });
    }
    proxy["then"] = (
      resolve: (v: unknown) => void,
      reject: (e: unknown) => void,
    ) => Promise.resolve(pendingResult).then(resolve, reject);

    (proxy as Record<string, ReturnType<typeof vi.fn>>)["from"] = vi.fn().mockImplementation((table: string) => {
      fromCallCount++;
      if (table === "approval_steps") {
        pendingResult = { data: steps, error: null, count: null };
      } else if (table === "step_votes") {
        pendingResult = { data: votes, error: null, count: null };
      }
      return proxy;
    });

    mockedCreateAdmin.mockReturnValue(proxy as ReturnType<typeof createAdminClient>);

    const result = await getRequestSteps("req-1");
    expect(result).toHaveLength(2);
    expect(result[0].votes).toHaveLength(2);
    expect(result[1].votes).toHaveLength(0);
  });
});
