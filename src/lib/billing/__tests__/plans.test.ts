import { describe, it, expect } from "vitest";
import {
  PLAN_LIMITS,
  PLAN_ORDER,
  getPlanLimits,
  hasFeature,
  isUnlimited,
  formatPrice,
} from "@/lib/billing/plans";
import type { BillingPlan } from "@/lib/types/database";

describe("PLAN_LIMITS", () => {
  const requiredFields = [
    "name",
    "priceMonthly",
    "priceYearly",
    "maxRequests",
    "maxConnections",
    "maxTeamMembers",
    "historyDays",
    "features",
  ] as const;

  it.each(["free", "pro", "business", "enterprise"] as BillingPlan[])(
    "plan '%s' has all required fields",
    (planId) => {
      const plan = PLAN_LIMITS[planId];
      expect(plan).toBeDefined();
      for (const field of requiredFields) {
        expect(plan).toHaveProperty(field);
      }
    },
  );

  it("all plans have non-empty name strings", () => {
    for (const planId of PLAN_ORDER) {
      expect(PLAN_LIMITS[planId].name).toBeTruthy();
      expect(typeof PLAN_LIMITS[planId].name).toBe("string");
    }
  });

  it("all plans have a features array", () => {
    for (const planId of PLAN_ORDER) {
      expect(Array.isArray(PLAN_LIMITS[planId].features)).toBe(true);
    }
  });

  it("free plan has limited requests, connections, and members", () => {
    const free = PLAN_LIMITS.free;
    expect(free.maxRequests).toBeGreaterThan(0);
    expect(free.maxConnections).toBeGreaterThan(0);
    expect(free.maxTeamMembers).toBeGreaterThan(0);
    expect(free.priceMonthly).toBe(0);
  });

  it("pro plan has unlimited requests but limited connections", () => {
    const pro = PLAN_LIMITS.pro;
    expect(isUnlimited(pro.maxRequests)).toBe(true);
    expect(isUnlimited(pro.maxConnections)).toBe(false);
  });

  it("business and enterprise plans have all limits unlimited", () => {
    for (const planId of ["business", "enterprise"] as BillingPlan[]) {
      const plan = PLAN_LIMITS[planId];
      expect(isUnlimited(plan.maxRequests)).toBe(true);
      expect(isUnlimited(plan.maxConnections)).toBe(true);
      expect(isUnlimited(plan.maxTeamMembers)).toBe(true);
    }
  });

  it("higher plans have a superset of lower plan features", () => {
    for (let i = 0; i < PLAN_ORDER.length - 1; i++) {
      const lower = PLAN_LIMITS[PLAN_ORDER[i]].features;
      const higher = PLAN_LIMITS[PLAN_ORDER[i + 1]].features;
      for (const feature of lower) {
        expect(higher).toContain(feature);
      }
    }
  });
});

describe("getPlanLimits", () => {
  it("returns correct limits for each plan", () => {
    expect(getPlanLimits("free").name).toBe("Free");
    expect(getPlanLimits("pro").name).toBe("Pro");
    expect(getPlanLimits("business").name).toBe("Business");
    expect(getPlanLimits("enterprise").name).toBe("Enterprise");
  });

  it("returns free plan limits for unknown plan", () => {
    const result = getPlanLimits("nonexistent" as BillingPlan);
    expect(result.name).toBe("Free");
  });
});

describe("hasFeature", () => {
  it("returns true for features included in the plan", () => {
    expect(hasFeature("free", "email_notifications")).toBe(true);
    expect(hasFeature("pro", "slack_notifications")).toBe(true);
    expect(hasFeature("business", "sso_saml")).toBe(true);
    expect(hasFeature("enterprise", "on_prem")).toBe(true);
  });

  it("returns false for features not included in the plan", () => {
    expect(hasFeature("free", "slack_notifications")).toBe(false);
    expect(hasFeature("free", "rules_engine")).toBe(false);
    expect(hasFeature("pro", "sso_saml")).toBe(false);
    expect(hasFeature("pro", "on_prem")).toBe(false);
  });

  it("returns false for a completely unknown feature", () => {
    expect(hasFeature("enterprise", "teleportation")).toBe(false);
  });
});

describe("isUnlimited", () => {
  it("returns true for -1", () => {
    expect(isUnlimited(-1)).toBe(true);
  });

  it("returns false for positive numbers", () => {
    expect(isUnlimited(0)).toBe(false);
    expect(isUnlimited(1)).toBe(false);
    expect(isUnlimited(100)).toBe(false);
  });
});

describe("formatPrice", () => {
  it("returns 'Free' for 0 cents", () => {
    expect(formatPrice(0)).toBe("Free");
  });

  it("formats cents to dollar string", () => {
    expect(formatPrice(2000)).toBe("$20");
    expect(formatPrice(6000)).toBe("$60");
  });
});

describe("PLAN_ORDER", () => {
  it("contains all 4 plans in ascending order", () => {
    expect(PLAN_ORDER).toEqual(["free", "pro", "business", "enterprise"]);
  });

  it("has exactly 4 entries", () => {
    expect(PLAN_ORDER).toHaveLength(4);
  });

  it("every entry exists in PLAN_LIMITS", () => {
    for (const planId of PLAN_ORDER) {
      expect(PLAN_LIMITS[planId]).toBeDefined();
    }
  });
});
