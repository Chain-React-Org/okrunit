import { describe, it, expect } from "vitest";
import {
  createApprovalSchema,
  respondApprovalSchema,
  createConnectionSchema,
  updateConnectionSchema,
  paginationSchema,
  createCommentSchema,
  batchApprovalSchema,
  batchArchiveSchema,
  createRuleSchema,
  createTeamSchema,
  createDelegationSchema,
  createTrustCounterSchema,
  updateOrgSettingsSchema,
  exportQuerySchema,
  analyticsQuerySchema,
} from "@/lib/api/validation";

describe("createApprovalSchema", () => {
  it("accepts a valid minimal body", () => {
    const result = createApprovalSchema.safeParse({ title: "Deploy to prod" });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated body", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy v2.0",
      description: "Release candidate for production",
      action_type: "deploy",
      priority: "high",
      callback_url: "https://example.com/callback",
      callback_headers: { Authorization: "Bearer tok" },
      metadata: { env: "prod" },
      context_html: "<p>Details</p>",
      expires_at: "2026-12-31T23:59:59Z",
      idempotency_key: "idem-123",
      required_approvals: 2,
      assigned_approvers: ["550e8400-e29b-41d4-a716-446655440000"],
      source: "zapier",
      is_sequential: true,
      auto_action: "approve",
      auto_action_after_minutes: 60,
      require_rejection_reason: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty string title", () => {
    const result = createApprovalSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 500 chars", () => {
    const result = createApprovalSchema.safeParse({ title: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority value", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      priority: "urgent",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid priority values", () => {
    for (const priority of ["low", "medium", "high", "critical"]) {
      const result = createApprovalSchema.safeParse({ title: "Test", priority });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid callback_url", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      callback_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects required_approvals exceeding max (10)", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      required_approvals: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects required_approvals of 0", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      required_approvals: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID assigned_approvers", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      assigned_approvers: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects description exceeding 5000 chars", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      description: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects context_html exceeding 50000 chars", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      context_html: "x".repeat(50001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects auto_action with invalid value", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      auto_action: "cancel",
    });
    expect(result.success).toBe(false);
  });
});

describe("respondApprovalSchema", () => {
  it("accepts approve decision", () => {
    const result = respondApprovalSchema.safeParse({ decision: "approve" });
    expect(result.success).toBe(true);
  });

  it("accepts reject decision with comment", () => {
    const result = respondApprovalSchema.safeParse({
      decision: "reject",
      comment: "Not ready yet",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid decision", () => {
    const result = respondApprovalSchema.safeParse({ decision: "maybe" });
    expect(result.success).toBe(false);
  });

  it("rejects missing decision", () => {
    const result = respondApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts all valid source values", () => {
    for (const source of ["dashboard", "email", "slack", "push", "api", "auto_rule", "batch"]) {
      const result = respondApprovalSchema.safeParse({ decision: "approve", source });
      expect(result.success).toBe(true);
    }
  });

  it("rejects comment exceeding 2000 chars", () => {
    const result = respondApprovalSchema.safeParse({
      decision: "approve",
      comment: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("createConnectionSchema", () => {
  it("accepts valid connection", () => {
    const result = createConnectionSchema.safeParse({ name: "My Connection" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createConnectionSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 100 chars", () => {
    const result = createConnectionSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects rate_limit_per_hour exceeding 10000", () => {
    const result = createConnectionSchema.safeParse({
      name: "Test",
      rate_limit_per_hour: 10001,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateConnectionSchema", () => {
  it("accepts partial update (name only)", () => {
    const result = updateConnectionSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts empty body (all fields optional)", () => {
    const result = updateConnectionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts is_active toggle", () => {
    const result = updateConnectionSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });
});

describe("paginationSchema", () => {
  it("accepts empty object with defaults", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid page and page_size", () => {
    const result = paginationSchema.safeParse({ page: 2, page_size: 50 });
    expect(result.success).toBe(true);
  });

  it("rejects page_size exceeding MAX_PAGE_SIZE (100)", () => {
    const result = paginationSchema.safeParse({ page_size: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects page < 1", () => {
    const result = paginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts valid status filter", () => {
    for (const status of ["pending", "approved", "rejected", "cancelled", "expired"]) {
      const result = paginationSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status filter", () => {
    const result = paginationSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });
});

describe("createCommentSchema", () => {
  it("accepts valid comment", () => {
    const result = createCommentSchema.safeParse({ body: "Looks good!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty body", () => {
    const result = createCommentSchema.safeParse({ body: "" });
    expect(result.success).toBe(false);
  });

  it("rejects body exceeding 5000 chars", () => {
    const result = createCommentSchema.safeParse({ body: "x".repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe("batchApprovalSchema", () => {
  it("accepts valid batch approval", () => {
    const result = batchApprovalSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      decision: "approve",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty ids array", () => {
    const result = batchApprovalSchema.safeParse({ ids: [], decision: "approve" });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 ids", () => {
    const ids = Array.from({ length: 51 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`,
    );
    const result = batchApprovalSchema.safeParse({ ids, decision: "approve" });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID ids", () => {
    const result = batchApprovalSchema.safeParse({
      ids: ["not-a-uuid"],
      decision: "approve",
    });
    expect(result.success).toBe(false);
  });
});

describe("batchArchiveSchema", () => {
  it("accepts valid archive action", () => {
    const result = batchArchiveSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      action: "archive",
    });
    expect(result.success).toBe(true);
  });

  it("accepts unarchive action", () => {
    const result = batchArchiveSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      action: "unarchive",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = batchArchiveSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      action: "delete",
    });
    expect(result.success).toBe(false);
  });
});

describe("createRuleSchema", () => {
  it("accepts valid rule", () => {
    const result = createRuleSchema.safeParse({
      name: "Auto-approve deploys",
      conditions: { source: "github" },
      action: "auto_approve",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createRuleSchema.safeParse({
      conditions: {},
      action: "auto_approve",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action", () => {
    const result = createRuleSchema.safeParse({
      name: "Test",
      conditions: {},
      action: "delete",
    });
    expect(result.success).toBe(false);
  });
});

describe("createTeamSchema", () => {
  it("accepts valid team", () => {
    const result = createTeamSchema.safeParse({ name: "Engineering" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createTeamSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("createDelegationSchema", () => {
  it("accepts valid delegation", () => {
    const result = createDelegationSchema.safeParse({
      delegate_id: "550e8400-e29b-41d4-a716-446655440000",
      ends_at: "2026-12-31T23:59:59Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID delegate_id", () => {
    const result = createDelegationSchema.safeParse({
      delegate_id: "not-uuid",
      ends_at: "2026-12-31T23:59:59Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing ends_at", () => {
    const result = createDelegationSchema.safeParse({
      delegate_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});

describe("createTrustCounterSchema", () => {
  it("accepts valid trust counter", () => {
    const result = createTrustCounterSchema.safeParse({
      match_field: "action_type",
      match_value: "deploy",
    });
    expect(result.success).toBe(true);
  });

  it("accepts with optional threshold", () => {
    const result = createTrustCounterSchema.safeParse({
      match_field: "source",
      match_value: "github",
      auto_approve_threshold: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid match_field", () => {
    const result = createTrustCounterSchema.safeParse({
      match_field: "unknown_field",
      match_value: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty match_value", () => {
    const result = createTrustCounterSchema.safeParse({
      match_field: "action_type",
      match_value: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateOrgSettingsSchema", () => {
  it("accepts partial update", () => {
    const result = updateOrgSettingsSchema.safeParse({ name: "New Org Name" });
    expect(result.success).toBe(true);
  });

  it("accepts rejection_reason_policy", () => {
    for (const policy of ["optional", "required", "required_high_critical"]) {
      const result = updateOrgSettingsSchema.safeParse({ rejection_reason_policy: policy });
      expect(result.success).toBe(true);
    }
  });

  it("accepts sla_config", () => {
    const result = updateOrgSettingsSchema.safeParse({
      sla_config: { low: 60, medium: 30, high: 15, critical: 5 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects session_timeout_minutes below 5", () => {
    const result = updateOrgSettingsSchema.safeParse({ session_timeout_minutes: 3 });
    expect(result.success).toBe(false);
  });
});

describe("exportQuerySchema", () => {
  it("accepts valid export query", () => {
    const result = exportQuerySchema.safeParse({ format: "csv" });
    expect(result.success).toBe(true);
  });

  it("accepts date filters", () => {
    const result = exportQuerySchema.safeParse({
      format: "json",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = exportQuerySchema.safeParse({
      start_date: "January 1, 2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("analyticsQuerySchema", () => {
  it("accepts empty object", () => {
    const result = analyticsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid period values", () => {
    for (const period of ["day", "week", "month"]) {
      const result = analyticsQuerySchema.safeParse({ period });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid period", () => {
    const result = analyticsQuerySchema.safeParse({ period: "year" });
    expect(result.success).toBe(false);
  });
});
