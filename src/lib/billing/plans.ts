import type { BillingPlan, Plan } from "@/lib/types/database";

/** Static plan definitions — mirrors the database `plans` table.
 *  Used for quick client-side checks without a DB query. */
export const PLAN_LIMITS: Record<BillingPlan, {
  name: string;
  priceMonthly: number; // dollars
  priceYearly: number;
  maxRequests: number;  // -1 = unlimited
  maxConnections: number;
  maxTeamMembers: number;
  historyDays: number;
  features: string[];
}> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    maxRequests: 100,
    maxConnections: 2,
    maxTeamMembers: 3,
    historyDays: 7,
    features: ["email_notifications"],
  },
  pro: {
    name: "Pro",
    priceMonthly: 20,
    priceYearly: 192, // $16/mo billed annually
    maxRequests: -1,
    maxConnections: 15,
    maxTeamMembers: 15,
    historyDays: 90,
    features: [
      "email_notifications",
      "slack_notifications",
      "webhook_notifications",
      "rules_engine",
      "analytics",
    ],
  },
  business: {
    name: "Business",
    priceMonthly: 60,
    priceYearly: 576, // $48/mo billed annually
    maxRequests: -1,
    maxConnections: -1,
    maxTeamMembers: -1,
    historyDays: 365,
    features: [
      "email_notifications",
      "slack_notifications",
      "webhook_notifications",
      "rules_engine",
      "analytics",
      "analytics_export",
      "sso_saml",
      "audit_log_export",
      "multi_step_approvals",
      "custom_routing",
    ],
  },
  enterprise: {
    name: "Enterprise",
    priceMonthly: 0, // custom
    priceYearly: 0,
    maxRequests: -1,
    maxConnections: -1,
    maxTeamMembers: -1,
    historyDays: -1,
    features: [
      "email_notifications",
      "slack_notifications",
      "webhook_notifications",
      "rules_engine",
      "analytics",
      "analytics_export",
      "sso_saml",
      "audit_log_export",
      "multi_step_approvals",
      "custom_routing",
      "dedicated_support",
      "on_prem",
      "custom_sla",
    ],
  },
};

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

export function getPlanLimits(planId: BillingPlan) {
  return PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
}

export function hasFeature(planId: BillingPlan, feature: string): boolean {
  return getPlanLimits(planId).features.includes(feature);
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(0)}`;
}

export const PLAN_ORDER: BillingPlan[] = ["free", "pro", "business", "enterprise"];
