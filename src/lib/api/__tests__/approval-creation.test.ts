// ---------------------------------------------------------------------------
// OKrunit -- Tests for Approval Creation Validation
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { createApprovalSchema } from "@/lib/api/validation";

// ---- Minimal and full requests --------------------------------------------

describe("createApprovalSchema - creation validation", () => {
  it("accepts a valid minimal request (title only)", () => {
    const result = createApprovalSchema.safeParse({ title: "Deploy to prod" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid full request with all fields", () => {
    const result = createApprovalSchema.safeParse({
      title: "Deploy v2.0 to production",
      description: "Release candidate ready for production",
      action_type: "deploy",
      priority: "high",
      callback_url: "https://example.com/webhook/callback",
      callback_headers: { Authorization: "Bearer token-123" },
      metadata: { environment: "production", version: "2.0.0", count: 42 },
      context_html: "<p>Deployment details here</p>",
      expires_at: "2026-12-31T23:59:59Z",
      idempotency_key: "unique-key-123",
      required_approvals: 3,
      assigned_approvers: ["550e8400-e29b-41d4-a716-446655440000"],
      source: "github",
      source_id: "pr-456",
      source_name: "Pull Request #456",
      source_url: "https://github.com/org/repo/pull/456",
      is_sequential: true,
      auto_action: "approve",
      auto_action_after_minutes: 120,
      require_rejection_reason: true,
      is_log: false,
      template_id: "660e8400-e29b-41d4-a716-446655440000",
      conditions: [
        {
          name: "CI check",
          check_type: "webhook",
          webhook_url: "https://ci.example.com/check",
          description: "Ensure CI passes",
        },
        {
          name: "Security review",
          check_type: "manual",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  // ---- Required field: title ------------------------------------------------

  it("rejects missing required title", () => {
    const result = createApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty string title", () => {
    const result = createApprovalSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 500 characters", () => {
    const result = createApprovalSchema.safeParse({ title: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts title at exactly 500 characters", () => {
    const result = createApprovalSchema.safeParse({ title: "a".repeat(500) });
    expect(result.success).toBe(true);
  });

  // ---- Priority validation --------------------------------------------------

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

  it("accepts request without priority (defaults are handled server-side)", () => {
    const result = createApprovalSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
  });

  // ---- Callback URL validation ----------------------------------------------

  it("rejects invalid callback_url", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      callback_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid HTTPS callback_url", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      callback_url: "https://hooks.example.com/v1/callback",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid HTTP callback_url", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      callback_url: "http://staging.example.com/callback",
    });
    expect(result.success).toBe(true);
  });

  // ---- Template ID (optional UUID) ------------------------------------------

  it("accepts template_id as a valid UUID", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      template_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects template_id that is not a valid UUID", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      template_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts request without template_id", () => {
    const result = createApprovalSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.template_id).toBeUndefined();
    }
  });

  // ---- Metadata accepts arbitrary JSON --------------------------------------

  it("accepts metadata with arbitrary JSON values", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      metadata: {
        string_value: "hello",
        number_value: 42,
        boolean_value: true,
        null_value: null,
        nested_object: { key: "value", deep: { level: 3 } },
        array_value: [1, "two", { three: 3 }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty metadata object", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      metadata: {},
    });
    expect(result.success).toBe(true);
  });

  // ---- Conditions array validation ------------------------------------------

  it("accepts valid conditions array", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      conditions: [
        { name: "Manual review", check_type: "manual" },
        {
          name: "Webhook check",
          check_type: "webhook",
          webhook_url: "https://ci.example.com/status",
          description: "Check CI status before proceeding",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects conditions with invalid check_type", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      conditions: [{ name: "Bad check", check_type: "automatic" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects conditions with empty name", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      conditions: [{ name: "", check_type: "manual" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects conditions array exceeding 20 items", () => {
    const conditions = Array.from({ length: 21 }, (_, i) => ({
      name: `Condition ${i}`,
      check_type: "manual" as const,
    }));
    const result = createApprovalSchema.safeParse({
      title: "Test",
      conditions,
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty conditions array as omitted (optional field)", () => {
    const result = createApprovalSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conditions).toBeUndefined();
    }
  });

  // ---- Auto action ----------------------------------------------------------

  it("accepts auto_action approve with timeout", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      auto_action: "approve",
      auto_action_after_minutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it("accepts auto_action reject", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      auto_action: "reject",
      auto_action_after_minutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid auto_action value", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      auto_action: "cancel",
    });
    expect(result.success).toBe(false);
  });

  // ---- Assigned approvers ---------------------------------------------------

  it("rejects non-UUID values in assigned_approvers", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      assigned_approvers: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple valid UUIDs in assigned_approvers", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      assigned_approvers: [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440001",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects assigned_approvers exceeding 10 items", () => {
    const approvers = Array.from(
      { length: 11 },
      (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`,
    );
    const result = createApprovalSchema.safeParse({
      title: "Test",
      assigned_approvers: approvers,
    });
    expect(result.success).toBe(false);
  });

  // ---- Source fields --------------------------------------------------------

  it("accepts source with source_id and source_name", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      source: "zapier",
      source_id: "zap-12345",
      source_name: "New Signup Zap",
    });
    expect(result.success).toBe(true);
  });

  it("accepts source_url as valid URL", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      source_url: "https://zapier.com/editor/12345",
    });
    expect(result.success).toBe(true);
  });

  it("rejects source_url that is not a valid URL", () => {
    const result = createApprovalSchema.safeParse({
      title: "Test",
      source_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});
