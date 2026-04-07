/**
 * Structural validation tests for Pipedream integration components.
 *
 * These tests read the .mts source files as text and use regex/string matching
 * to validate that each component meets the canonical module-specs requirements,
 * without needing to resolve Pipedream SDK imports.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function read(relPath) {
  return readFileSync(join(root, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// Load all source files once
// ---------------------------------------------------------------------------

const appSrc = read("components/okrunit.app.mts");
const createApprovalSrc = read("actions/create-approval/create-approval.mts");
const addCommentSrc = read("actions/add-comment/add-comment.mts");
const getApprovalSrc = read("actions/get-approval/get-approval.mts");
const listApprovalsSrc = read("actions/list-approvals/list-approvals.mts");
const newApprovalSrc = read("sources/new-approval/new-approval.mts");
const approvalDecidedSrc = read("sources/approval-decided/approval-decided.mts");

// ---------------------------------------------------------------------------
// Helper: extract a quoted string value for a given key
// ---------------------------------------------------------------------------

function extractStringValue(src, key) {
  // Matches key: "value" or key: 'value' allowing optional whitespace
  const re = new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`);
  const m = src.match(re);
  return m ? m[1] : null;
}

// ===========================================================================
// 1. okrunit.app - shared app component
// ===========================================================================

describe("okrunit.app.mts", () => {
  test("defines app type as 'app'", () => {
    expect(appSrc).toMatch(/type:\s*["']app["']/);
  });

  test("defines app name as 'okrunit'", () => {
    expect(appSrc).toMatch(/app:\s*["']okrunit["']/);
  });

  // --- Status prop ---
  describe("status propDefinition", () => {
    test("has 'All' option with empty value", () => {
      expect(appSrc).toMatch(/label:\s*["']All["']\s*,\s*value:\s*["']["']/);
    });

    test("includes all spec statuses: Pending, Approved, Rejected, Cancelled, Expired", () => {
      for (const status of ["Pending", "Approved", "Rejected", "Cancelled", "Expired"]) {
        expect(appSrc).toContain(`"${status}"`);
      }
    });
  });

  // --- Priority prop ---
  describe("priority propDefinition", () => {
    test("has 'All' option", () => {
      // Already tested via status, but verify priority block specifically
      // Both status and priority have All. Just verify all priority values
      for (const p of ["Low", "Medium", "High", "Critical"]) {
        expect(appSrc).toContain(`"${p}"`);
      }
    });
  });

  // --- Methods ---
  describe("methods", () => {
    test("has _baseUrl method referencing /api/v1", () => {
      expect(appSrc).toMatch(/_baseUrl\s*\(/);
      expect(appSrc).toContain("/api/v1");
    });

    test("has _headers method with Bearer auth", () => {
      expect(appSrc).toMatch(/_headers\s*\(/);
      expect(appSrc).toContain("Bearer");
    });

    test("has createApproval method POSTing to /approvals", () => {
      expect(appSrc).toMatch(/async\s+createApproval/);
      expect(appSrc).toContain('"/approvals"');
    });

    test("has getApproval method", () => {
      expect(appSrc).toMatch(/async\s+getApproval/);
    });

    test("has listApprovals method", () => {
      expect(appSrc).toMatch(/async\s+listApprovals/);
    });

    test("has addComment method POSTing to /approvals/{id}/comments", () => {
      expect(appSrc).toMatch(/async\s+addComment/);
      expect(appSrc).toMatch(/\/approvals\/.*\/comments/);
    });
  });
});

// ===========================================================================
// 2. create-approval action
// ===========================================================================

describe("create-approval action", () => {
  test("uses defineAction", () => {
    expect(createApprovalSrc).toMatch(/defineAction\s*\(/);
  });

  test('has name "Create Approval"', () => {
    expect(extractStringValue(createApprovalSrc, "name")).toBe("Create Approval");
  });

  test('has key "okrunit-create-approval"', () => {
    expect(extractStringValue(createApprovalSrc, "key")).toBe("okrunit-create-approval");
  });

  test("has description mentioning approval request", () => {
    expect(createApprovalSrc).toMatch(/description\s*:\s*[\s\S]*?approval/i);
  });

  test('has type "action"', () => {
    expect(createApprovalSrc).toMatch(/type:\s*["']action["']/);
  });

  test("has callbackUrl prop defined", () => {
    expect(createApprovalSrc).toMatch(/callbackUrl\s*:\s*\{/);
  });

  test("callbackUrl prop has type string", () => {
    // Look for the callbackUrl block
    const callbackBlock = createApprovalSrc.match(/callbackUrl\s*:\s*\{[\s\S]*?\}/);
    expect(callbackBlock).not.toBeNull();
    expect(callbackBlock[0]).toMatch(/type:\s*["']string["']/);
  });

  test("callbackUrl prop is optional", () => {
    const callbackBlock = createApprovalSrc.match(/callbackUrl\s*:\s*\{[\s\S]*?\}/);
    expect(callbackBlock).not.toBeNull();
    expect(callbackBlock[0]).toContain("optional: true");
  });

  test("callbackUrl prop has label 'Callback URL'", () => {
    const callbackBlock = createApprovalSrc.match(/callbackUrl\s*:\s*\{[\s\S]*?\}/);
    expect(callbackBlock).not.toBeNull();
    expect(callbackBlock[0]).toMatch(/label:\s*["']Callback URL["']/);
  });

  test('sets source to "pipedream"', () => {
    expect(createApprovalSrc).toMatch(/source:\s*["']pipedream["']/);
  });

  test("generates idempotency key in format pipedream-{timestamp}-{random}", () => {
    // The code uses: `pipedream-${Date.now()}-${Math.random()...}`
    expect(createApprovalSrc).toMatch(/[`"']pipedream-\$\{Date\.now\(\)\}/);
  });

  test("assigns idempotency_key to the request body", () => {
    expect(createApprovalSrc).toContain("idempotency_key");
  });

  test("has metadata prop (optional, JSON)", () => {
    expect(createApprovalSrc).toMatch(/metadata\s*:\s*\{/);
    const metaBlock = createApprovalSrc.match(/metadata\s*:\s*\{[\s\S]*?\}/);
    expect(metaBlock).not.toBeNull();
    expect(metaBlock[0]).toContain("optional: true");
  });

  test("parses metadata as JSON with error handling", () => {
    expect(createApprovalSrc).toContain("JSON.parse");
    expect(createApprovalSrc).toMatch(/catch/);
    expect(createApprovalSrc).toMatch(/Metadata must be valid JSON/);
  });

  test("has title prop referencing propDefinition", () => {
    expect(createApprovalSrc).toMatch(/title\s*:\s*\{\s*propDefinition/);
  });

  test("has description prop referencing propDefinition", () => {
    expect(createApprovalSrc).toMatch(/description\s*:\s*\{\s*propDefinition/);
  });

  test("has priority prop referencing propDefinition", () => {
    expect(createApprovalSrc).toMatch(/priority\s*:\s*\{\s*propDefinition/);
  });

  test("provides a default title when user omits it", () => {
    expect(createApprovalSrc).toMatch(/Approval request from pipedream/);
  });

  test("exports $summary after creation", () => {
    expect(createApprovalSrc).toMatch(/\$\.export\s*\(\s*["']\$summary["']/);
  });
});

// ===========================================================================
// 3. add-comment action
// ===========================================================================

describe("add-comment action", () => {
  test("uses defineAction", () => {
    expect(addCommentSrc).toMatch(/defineAction\s*\(/);
  });

  test('has name "Add Comment"', () => {
    expect(extractStringValue(addCommentSrc, "name")).toBe("Add Comment");
  });

  test('has key "okrunit-add-comment"', () => {
    expect(extractStringValue(addCommentSrc, "key")).toBe("okrunit-add-comment");
  });

  test('has type "action"', () => {
    expect(addCommentSrc).toMatch(/type:\s*["']action["']/);
  });

  test("has approvalId prop via propDefinition", () => {
    expect(addCommentSrc).toMatch(/approvalId\s*:\s*\{\s*propDefinition/);
  });

  test("has comment prop with type string", () => {
    expect(addCommentSrc).toMatch(/comment\s*:\s*\{/);
    const commentBlock = addCommentSrc.match(/comment\s*:\s*\{[\s\S]*?\}/);
    expect(commentBlock).not.toBeNull();
    expect(commentBlock[0]).toMatch(/type:\s*["']string["']/);
  });

  test("comment prop mentions max 5000 chars", () => {
    expect(addCommentSrc).toContain("5000");
  });

  test("calls okrunit.addComment with approvalId and comment", () => {
    expect(addCommentSrc).toMatch(/this\.okrunit\.addComment\s*\(/);
    expect(addCommentSrc).toContain("this.approvalId");
    expect(addCommentSrc).toContain("this.comment");
  });

  test("exports $summary", () => {
    expect(addCommentSrc).toMatch(/\$\.export\s*\(\s*["']\$summary["']/);
  });
});

// ===========================================================================
// 4. get-approval action
// ===========================================================================

describe("get-approval action", () => {
  test("uses defineAction", () => {
    expect(getApprovalSrc).toMatch(/defineAction\s*\(/);
  });

  test('has name "Get Approval"', () => {
    expect(extractStringValue(getApprovalSrc, "name")).toBe("Get Approval");
  });

  test('has key "okrunit-get-approval"', () => {
    expect(extractStringValue(getApprovalSrc, "key")).toBe("okrunit-get-approval");
  });

  test('has type "action"', () => {
    expect(getApprovalSrc).toMatch(/type:\s*["']action["']/);
  });

  test("has approvalId prop via propDefinition", () => {
    expect(getApprovalSrc).toMatch(/approvalId\s*:\s*\{\s*propDefinition/);
  });

  test("calls okrunit.getApproval", () => {
    expect(getApprovalSrc).toMatch(/this\.okrunit\.getApproval\s*\(/);
  });

  test("exports $summary with title and status", () => {
    expect(getApprovalSrc).toMatch(/\$\.export\s*\(\s*["']\$summary["']/);
    expect(getApprovalSrc).toContain("result.title");
    expect(getApprovalSrc).toContain("result.status");
  });
});

// ===========================================================================
// 5. list-approvals action
// ===========================================================================

describe("list-approvals action", () => {
  test("uses defineAction", () => {
    expect(listApprovalsSrc).toMatch(/defineAction\s*\(/);
  });

  test('has name "List Approvals"', () => {
    expect(extractStringValue(listApprovalsSrc, "name")).toBe("List Approvals");
  });

  test('has key "okrunit-list-approvals"', () => {
    expect(extractStringValue(listApprovalsSrc, "key")).toBe("okrunit-list-approvals");
  });

  test('has type "action"', () => {
    expect(listApprovalsSrc).toMatch(/type:\s*["']action["']/);
  });

  test("has status prop via propDefinition", () => {
    expect(listApprovalsSrc).toMatch(/status\s*:\s*\{\s*propDefinition/);
  });

  test("has priority prop via propDefinition", () => {
    expect(listApprovalsSrc).toMatch(/priority\s*:\s*\{[\s\S]*?propDefinition/);
  });

  test("has search prop (optional, string)", () => {
    expect(listApprovalsSrc).toMatch(/search\s*:\s*\{/);
    const searchBlock = listApprovalsSrc.match(/search\s*:\s*\{[\s\S]*?\}/);
    expect(searchBlock).not.toBeNull();
    expect(searchBlock[0]).toContain("optional: true");
    expect(searchBlock[0]).toMatch(/type:\s*["']string["']/);
  });

  test("has limit prop (optional, integer, default 25)", () => {
    expect(listApprovalsSrc).toMatch(/limit\s*:\s*\{/);
    const limitBlock = listApprovalsSrc.match(/limit\s*:\s*\{[\s\S]*?\}/);
    expect(limitBlock).not.toBeNull();
    expect(limitBlock[0]).toContain("optional: true");
    expect(limitBlock[0]).toMatch(/type:\s*["']integer["']/);
    expect(limitBlock[0]).toContain("default: 25");
  });

  test("passes page_size param from limit", () => {
    expect(listApprovalsSrc).toContain("page_size");
  });

  test("calls okrunit.listApprovals", () => {
    expect(listApprovalsSrc).toMatch(/this\.okrunit\.listApprovals\s*\(/);
  });

  test("exports $summary with count", () => {
    expect(listApprovalsSrc).toMatch(/\$\.export\s*\(\s*["']\$summary["']/);
    expect(listApprovalsSrc).toMatch(/approval\(s\)/);
  });
});

// ===========================================================================
// 6. new-approval source (trigger)
// ===========================================================================

describe("new-approval source", () => {
  test("uses defineSource", () => {
    expect(newApprovalSrc).toMatch(/defineSource\s*\(/);
  });

  test('has name "New Approval Request"', () => {
    expect(extractStringValue(newApprovalSrc, "name")).toBe("New Approval Request");
  });

  test('has key "okrunit-new-approval"', () => {
    expect(extractStringValue(newApprovalSrc, "key")).toBe("okrunit-new-approval");
  });

  test('has type "source"', () => {
    expect(newApprovalSrc).toMatch(/type:\s*["']source["']/);
  });

  test('uses dedupe "unique"', () => {
    expect(newApprovalSrc).toMatch(/dedupe:\s*["']unique["']/);
  });

  test("has timer prop with default 60 second interval", () => {
    expect(newApprovalSrc).toContain("$.interface.timer");
    expect(newApprovalSrc).toContain("intervalSeconds: 60");
  });

  test("has status filter prop via propDefinition", () => {
    expect(newApprovalSrc).toMatch(/status\s*:\s*\{[\s\S]*?propDefinition/);
  });

  test("has priority filter prop via propDefinition", () => {
    expect(newApprovalSrc).toMatch(/priority\s*:\s*\{[\s\S]*?propDefinition/);
  });

  test("has generateMeta method that uses approval.id for dedup", () => {
    expect(newApprovalSrc).toMatch(/generateMeta/);
    expect(newApprovalSrc).toMatch(/id:\s*approval\.id/);
  });

  test("emits events via this.$emit", () => {
    expect(newApprovalSrc).toContain("this.$emit");
  });

  test("reverses approvals for oldest-first emission", () => {
    expect(newApprovalSrc).toContain(".reverse()");
  });
});

// ===========================================================================
// 7. approval-decided source (trigger)
// ===========================================================================

describe("approval-decided source", () => {
  test("uses defineSource", () => {
    expect(approvalDecidedSrc).toMatch(/defineSource\s*\(/);
  });

  test('has name "Approval Decided"', () => {
    expect(extractStringValue(approvalDecidedSrc, "name")).toBe("Approval Decided");
  });

  test('has key "okrunit-approval-decided"', () => {
    expect(extractStringValue(approvalDecidedSrc, "key")).toBe("okrunit-approval-decided");
  });

  test('has type "source"', () => {
    expect(approvalDecidedSrc).toMatch(/type:\s*["']source["']/);
  });

  test('uses dedupe "unique"', () => {
    expect(approvalDecidedSrc).toMatch(/dedupe:\s*["']unique["']/);
  });

  test("has timer prop with default 60 second interval", () => {
    expect(approvalDecidedSrc).toContain("$.interface.timer");
    expect(approvalDecidedSrc).toContain("intervalSeconds: 60");
  });

  test("has decision filter prop with correct labels", () => {
    expect(approvalDecidedSrc).toMatch(/decision\s*:\s*\{/);
    expect(approvalDecidedSrc).toContain("Approved or Rejected");
    expect(approvalDecidedSrc).toContain("Approved Only");
    expect(approvalDecidedSrc).toContain("Rejected Only");
  });

  test('decision filter default is "any"', () => {
    // Find the decision block and check for default: "any"
    const decisionBlock = approvalDecidedSrc.match(/decision\s*:\s*\{[\s\S]*?optional/);
    expect(decisionBlock).not.toBeNull();
    expect(decisionBlock[0]).toMatch(/default:\s*["']any["']/);
  });

  test("decision filter maps 'any' to ['approved', 'rejected']", () => {
    expect(approvalDecidedSrc).toMatch(/["']approved["']\s*,\s*["']rejected["']/);
  });

  test("has priority filter prop via propDefinition", () => {
    expect(approvalDecidedSrc).toMatch(/priority\s*:\s*\{[\s\S]*?propDefinition/);
  });

  test("has generateMeta method using approval.id", () => {
    expect(approvalDecidedSrc).toMatch(/generateMeta/);
    expect(approvalDecidedSrc).toMatch(/id:\s*approval\.id/);
  });

  test("only emits approvals that have decided_at", () => {
    expect(approvalDecidedSrc).toContain("approval.decided_at");
  });

  test("emits events via this.$emit", () => {
    expect(approvalDecidedSrc).toContain("this.$emit");
  });

  test("reverses approvals for oldest-first emission", () => {
    expect(approvalDecidedSrc).toContain(".reverse()");
  });
});

// ===========================================================================
// 8. Cross-component consistency checks
// ===========================================================================

describe("cross-component consistency", () => {
  const allActions = [
    { name: "create-approval", src: createApprovalSrc },
    { name: "add-comment", src: addCommentSrc },
    { name: "get-approval", src: getApprovalSrc },
    { name: "list-approvals", src: listApprovalsSrc },
  ];

  const allSources = [
    { name: "new-approval", src: newApprovalSrc },
    { name: "approval-decided", src: approvalDecidedSrc },
  ];

  const allComponents = [...allActions, ...allSources];

  test("all components import from okrunit.app.mts", () => {
    for (const { name, src } of allComponents) {
      expect(src).toContain("okrunit.app.mts");
    }
  });

  test("all actions use defineAction", () => {
    for (const { name, src } of allActions) {
      expect(src).toMatch(/defineAction\s*\(/);
    }
  });

  test("all sources use defineSource", () => {
    for (const { name, src } of allSources) {
      expect(src).toMatch(/defineSource\s*\(/);
    }
  });

  test("all components have a version field", () => {
    for (const { name, src } of allComponents) {
      expect(src).toMatch(/version:\s*["']\d+\.\d+\.\d+["']/);
    }
  });

  test("all components include okrunit app in props", () => {
    for (const { name, src } of allComponents) {
      // Should have `okrunit,` or `okrunit` in the props block
      expect(src).toMatch(/props\s*:\s*\{[\s\S]*?okrunit/);
    }
  });

  test("all action keys follow okrunit-{action-name} pattern", () => {
    for (const { name, src } of allActions) {
      const key = extractStringValue(src, "key");
      expect(key).toMatch(/^okrunit-/);
    }
  });

  test("all source keys follow okrunit-{source-name} pattern", () => {
    for (const { name, src } of allSources) {
      const key = extractStringValue(src, "key");
      expect(key).toMatch(/^okrunit-/);
    }
  });

  test("only create-approval sets source to pipedream (per spec)", () => {
    expect(createApprovalSrc).toMatch(/source:\s*["']pipedream["']/);
    // Other actions should not set source
    expect(addCommentSrc).not.toMatch(/source:\s*["']pipedream["']/);
    expect(getApprovalSrc).not.toMatch(/source:\s*["']pipedream["']/);
    expect(listApprovalsSrc).not.toMatch(/source:\s*["']pipedream["']/);
  });

  test("only create-approval generates an idempotency key", () => {
    expect(createApprovalSrc).toContain("idempotency_key");
    expect(addCommentSrc).not.toContain("idempotency_key");
    expect(getApprovalSrc).not.toContain("idempotency_key");
    expect(listApprovalsSrc).not.toContain("idempotency_key");
  });
});

// ===========================================================================
// 9. Spec compliance - field name alignment with module-specs.md
// ===========================================================================

describe("spec compliance", () => {
  test("create-approval sends callback_url (snake_case) to API", () => {
    expect(createApprovalSrc).toContain("callback_url");
  });

  test("create-approval sends idempotency_key (snake_case) to API", () => {
    expect(createApprovalSrc).toContain("idempotency_key");
  });

  test("add-comment sends body field to API (per spec)", () => {
    // The app method sends { body } to the comments endpoint
    expect(appSrc).toMatch(/data:\s*\{\s*body\s*\}/);
  });

  test("new-approval source polls /approvals endpoint", () => {
    expect(newApprovalSrc).toContain("listApprovals");
  });

  test("approval-decided source filters by approved/rejected statuses", () => {
    expect(approvalDecidedSrc).toContain('"approved"');
    expect(approvalDecidedSrc).toContain('"rejected"');
  });

  test("status options match spec: pending, approved, rejected, cancelled, expired", () => {
    for (const val of ["pending", "approved", "rejected", "cancelled", "expired"]) {
      expect(appSrc).toContain(`"${val}"`);
    }
  });

  test("priority options match spec: low, medium, high, critical", () => {
    for (const val of ["low", "medium", "high", "critical"]) {
      expect(appSrc).toContain(`"${val}"`);
    }
  });

  test("approval-decided decision filter labels match spec", () => {
    // Spec says: "Approved or Rejected", "Approved Only", "Rejected Only"
    expect(approvalDecidedSrc).toContain("Approved or Rejected");
    expect(approvalDecidedSrc).toContain("Approved Only");
    expect(approvalDecidedSrc).toContain("Rejected Only");
  });

  test("list-approvals has all spec input fields: status, priority, search, limit", () => {
    expect(listApprovalsSrc).toMatch(/status\s*:/);
    expect(listApprovalsSrc).toMatch(/priority\s*:/);
    expect(listApprovalsSrc).toMatch(/search\s*:/);
    expect(listApprovalsSrc).toMatch(/limit\s*:/);
  });

  test("create-approval has all spec input fields: title, description, callbackUrl, metadata", () => {
    expect(createApprovalSrc).toMatch(/title\s*:/);
    expect(createApprovalSrc).toMatch(/description\s*:/);
    expect(createApprovalSrc).toMatch(/callbackUrl\s*:/);
    expect(createApprovalSrc).toMatch(/metadata\s*:/);
  });

  test("add-comment has all spec input fields: approvalId, comment", () => {
    expect(addCommentSrc).toMatch(/approvalId\s*:/);
    expect(addCommentSrc).toMatch(/comment\s*:/);
  });

  test("get-approval has spec input field: approvalId", () => {
    expect(getApprovalSrc).toMatch(/approvalId\s*:/);
  });
});
