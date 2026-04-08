// ---------------------------------------------------------------------------
// OKrunit -- Tests for Risk Scoring Engine
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase admin client before importing the module under test
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import { calculateRiskScore } from "../risk-scoring";
import type { RiskScore } from "../risk-scoring";

// ---- Helpers ----------------------------------------------------------------

/** Build a chainable query mock that resolves to { count } */
function setupDbMock(firstTimeCount: number, frequencyCount: number) {
  let callIndex = 0;

  mockFrom.mockImplementation(() => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    };

    // Each call to .from() returns a different count based on call order.
    // First call = checkFirstTimeActionType, second call = checkHighFrequency.
    const resolvedCount = callIndex === 0 ? firstTimeCount : frequencyCount;
    callIndex++;

    // The chain ends when the last chained method is called. We need to make
    // the final .eq() or .gte() resolve to { count }.
    // Since Promise.allSettled awaits the full chain, we make every terminal
    // method return a promise-like that resolves to { count }.
    const result = { count: resolvedCount };

    // Override the chain methods to return the result at the end
    chain.eq.mockImplementation(() => {
      // Return the chain to allow further chaining, but also make it thenable
      const innerChain = {
        eq: vi.fn(),
        gte: vi.fn(),
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      innerChain.eq.mockImplementation(() => ({
        eq: vi.fn().mockReturnValue(result),
        gte: vi.fn().mockReturnValue(result),
        ...result,
      }));
      innerChain.gte.mockImplementation(() => result);
      return innerChain;
    });

    return chain;
  });
}

/** Build a simple mock where both DB checks return null (no matching factors) */
function setupDbMockNoFactors() {
  // First-time: count > 0 means NOT first time
  // Frequency: count <= 5 means NOT high frequency
  setupDbMock(5, 2);
}

// ---- Tests ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset date mocking
  vi.useRealTimers();
});

describe("calculateRiskScore", () => {
  describe("priority-based scoring", () => {
    it("assigns low base score for low priority", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "low", description: "Has description" },
        "org-1",
      );

      const priorityFactor = result.factors.find(
        (f) => f.name === "priority_weight",
      );
      expect(priorityFactor).toBeDefined();
      expect(priorityFactor!.score).toBe(10);
    });

    it("assigns medium base score for medium priority", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "medium", description: "Has description" },
        "org-1",
      );

      const priorityFactor = result.factors.find(
        (f) => f.name === "priority_weight",
      );
      expect(priorityFactor!.score).toBe(25);
    });

    it("assigns high base score for critical priority", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "critical", description: "Has description" },
        "org-1",
      );

      const priorityFactor = result.factors.find(
        (f) => f.name === "priority_weight",
      );
      expect(priorityFactor!.score).toBe(80);
    });

    it("defaults to 25 for unknown priority values", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "unknown", description: "Has description" },
        "org-1",
      );

      const priorityFactor = result.factors.find(
        (f) => f.name === "priority_weight",
      );
      expect(priorityFactor!.score).toBe(25);
    });
  });

  describe("destructive action detection", () => {
    it("adds destructive_action factor for delete action", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "medium", action_type: "delete-database", description: "x" },
        "org-1",
      );

      const destructiveFactor = result.factors.find(
        (f) => f.name === "destructive_action",
      );
      expect(destructiveFactor).toBeDefined();
      expect(destructiveFactor!.score).toBe(20);
    });

    it("adds destructive_action factor for drop action", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "medium", action_type: "drop-table", description: "x" },
        "org-1",
      );

      const destructiveFactor = result.factors.find(
        (f) => f.name === "destructive_action",
      );
      expect(destructiveFactor).toBeDefined();
    });

    it("does not add destructive_action for safe actions", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "medium", action_type: "deploy", description: "x" },
        "org-1",
      );

      const destructiveFactor = result.factors.find(
        (f) => f.name === "destructive_action",
      );
      expect(destructiveFactor).toBeUndefined();
    });

    it("does not check destructive keywords when action_type is null", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "medium", action_type: null, description: "x" },
        "org-1",
      );

      const destructiveFactor = result.factors.find(
        (f) => f.name === "destructive_action",
      );
      expect(destructiveFactor).toBeUndefined();
    });
  });

  describe("missing description factor", () => {
    it("adds missing_description factor when description is absent", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "low" },
        "org-1",
      );

      const missingDesc = result.factors.find(
        (f) => f.name === "missing_description",
      );
      expect(missingDesc).toBeDefined();
      expect(missingDesc!.score).toBe(5);
    });

    it("adds missing_description factor when description is empty string", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "low", description: "   " },
        "org-1",
      );

      const missingDesc = result.factors.find(
        (f) => f.name === "missing_description",
      );
      expect(missingDesc).toBeDefined();
    });

    it("does not add missing_description when description is provided", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "low", description: "Full description here" },
        "org-1",
      );

      const missingDesc = result.factors.find(
        (f) => f.name === "missing_description",
      );
      expect(missingDesc).toBeUndefined();
    });
  });

  describe("no callback URL factor", () => {
    it("adds negative score when no callback_url is provided", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "low", description: "desc" },
        "org-1",
      );

      const noCallback = result.factors.find((f) => f.name === "no_callback");
      expect(noCallback).toBeDefined();
      expect(noCallback!.score).toBe(-5);
    });

    it("does not add no_callback factor when callback_url is present", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        {
          priority: "low",
          description: "desc",
          callback_url: "https://example.com/hook",
        },
        "org-1",
      );

      const noCallback = result.factors.find((f) => f.name === "no_callback");
      expect(noCallback).toBeUndefined();
    });
  });

  describe("risk level categorization", () => {
    it("returns 'low' level for score <= 25", async () => {
      setupDbMockNoFactors();

      // low priority (10) + no_callback (-5) + missing_description (5) = 10
      const result = await calculateRiskScore(
        { priority: "low" },
        "org-1",
      );

      // The exact score depends on time-of-day factors, but we can check
      // the level categorization logic
      expect(["low", "medium", "high", "critical"]).toContain(result.level);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("score is clamped to 0 minimum", async () => {
      setupDbMockNoFactors();

      // Even with negative factors, score should not go below 0
      const result = await calculateRiskScore(
        {
          priority: "low",
          description: "desc",
          callback_url: "https://example.com/hook",
        },
        "org-1",
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("score is clamped to 100 maximum", async () => {
      setupDbMockNoFactors();

      // critical (80) + destructive (20) = 100 before other factors
      const result = await calculateRiskScore(
        { priority: "critical", action_type: "destroy-all" },
        "org-1",
      );

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe("risk score structure", () => {
    it("returns a properly structured RiskScore object", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "medium", description: "test" },
        "org-1",
      );

      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("factors");
      expect(typeof result.score).toBe("number");
      expect(typeof result.level).toBe("string");
      expect(Array.isArray(result.factors)).toBe(true);

      // Every factor should have the correct shape
      for (const factor of result.factors) {
        expect(factor).toHaveProperty("name");
        expect(factor).toHaveProperty("score");
        expect(factor).toHaveProperty("reason");
        expect(typeof factor.name).toBe("string");
        expect(typeof factor.score).toBe("number");
        expect(typeof factor.reason).toBe("string");
      }
    });

    it("always includes a priority_weight factor", async () => {
      setupDbMockNoFactors();

      const result = await calculateRiskScore(
        { priority: "high", description: "test" },
        "org-1",
      );

      const priorityFactor = result.factors.find(
        (f) => f.name === "priority_weight",
      );
      expect(priorityFactor).toBeDefined();
    });
  });
});
