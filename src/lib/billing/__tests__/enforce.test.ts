import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__mocks__/supabase";

// Mock createAdminClient before importing the module under test
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import {
  canCreateRequest,
  canCreateConnection,
  canAddTeamMember,
  canUseFeature,
  getUsageSummary,
  getOrgPlan,
} from "@/lib/billing/enforce";

const mockedCreateAdmin = vi.mocked(createAdminClient);

describe("getOrgPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the plan from an active subscription", async () => {
    const { mockClient, mockResult } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockResult({ data: { plan_id: "pro", status: "active" } });

    const plan = await getOrgPlan("org-1");
    expect(plan).toBe("pro");
  });

  it("returns 'free' when subscription is not active", async () => {
    const { mockClient, mockResult } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockResult({ data: { plan_id: "pro", status: "cancelled" } });

    const plan = await getOrgPlan("org-1");
    expect(plan).toBe("free");
  });

  it("returns 'free' when no subscription found", async () => {
    const { mockClient, mockResult } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockResult({ data: null });

    const plan = await getOrgPlan("org-1");
    expect(plan).toBe("free");
  });
});

describe("canCreateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when under limit (free plan)", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "free", status: "active" } },
      approval_requests: { count: 50, data: null },
    });

    const result = await canCreateRequest("org-1");
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("free");
  });

  it("blocks when at limit (free plan, 100 requests)", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "free", status: "active" } },
      approval_requests: { count: 100, data: null },
    });

    const result = await canCreateRequest("org-1");
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
    expect(result.reason).toContain("100");
  });

  it("always allows for pro plan (unlimited requests)", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "pro", status: "active" } },
    });

    const result = await canCreateRequest("org-1");
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("pro");
  });
});

describe("canCreateConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when under limit", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "free", status: "active" } },
      connections: { count: 1, data: null },
    });

    const result = await canCreateConnection("org-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks when at limit", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "free", status: "active" } },
      connections: { count: 2, data: null },
    });

    const result = await canCreateConnection("org-1");
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });

  it("always allows for business plan (unlimited connections)", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "business", status: "active" } },
    });

    const result = await canCreateConnection("org-1");
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("business");
  });
});

describe("canAddTeamMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows when under limit", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "free", status: "active" } },
      org_memberships: { count: 2, data: null },
    });

    const result = await canAddTeamMember("org-1");
    expect(result.allowed).toBe(true);
  });

  it("blocks when at limit", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "free", status: "active" } },
      org_memberships: { count: 3, data: null },
    });

    const result = await canAddTeamMember("org-1");
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });

  it("always allows for enterprise plan (unlimited members)", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockTableResults({
      subscriptions: { data: { plan_id: "enterprise", status: "active" } },
    });

    const result = await canAddTeamMember("org-1");
    expect(result.allowed).toBe(true);
  });
});

describe("canUseFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows feature available on the plan", async () => {
    const { mockClient, mockResult } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockResult({ data: { plan_id: "pro", status: "active" } });

    const result = await canUseFeature("org-1", "slack_notifications");
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe("pro");
  });

  it("blocks feature not available on the plan", async () => {
    const { mockClient, mockResult } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockResult({ data: { plan_id: "free", status: "active" } });

    const result = await canUseFeature("org-1", "slack_notifications");
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
    expect(result.reason).toContain("slack notifications");
  });

  it("all plans have email_notifications", async () => {
    const { mockClient, mockResult } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);
    mockResult({ data: { plan_id: "free", status: "active" } });

    const result = await canUseFeature("org-1", "email_notifications");
    expect(result.allowed).toBe(true);
  });
});

describe("getUsageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct structure with usage and limits", async () => {
    const { mockClient, mockTableResults } = createMockSupabaseClient();
    mockedCreateAdmin.mockReturnValue(mockClient as ReturnType<typeof createAdminClient>);

    // getUsageSummary uses Promise.all for 3 queries, then getOrgPlan for a 4th.
    // Our mock uses the last table set via `from()` calls.
    // Since the mock resolves based on the last `from()` call, we set up per-table.
    mockTableResults({
      approval_requests: { count: 42, data: null },
      connections: { count: 5, data: null },
      org_memberships: { count: 3, data: null },
      subscriptions: { data: { plan_id: "pro", status: "active" } },
    });

    const summary = await getUsageSummary("org-1");

    expect(summary).toHaveProperty("plan");
    expect(summary).toHaveProperty("limits");
    expect(summary).toHaveProperty("usage");
    expect(summary.usage).toHaveProperty("requests");
    expect(summary.usage).toHaveProperty("connections");
    expect(summary.usage).toHaveProperty("teamMembers");
    expect(summary.plan).toBe("pro");
  });
});
