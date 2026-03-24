import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanLimits, isUnlimited } from "@/lib/billing/plans";
import type { BillingPlan } from "@/lib/types/database";

interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  plan?: BillingPlan;
  upgradeRequired?: boolean;
}

/** Get the org's current plan */
export async function getOrgPlan(orgId: string): Promise<BillingPlan> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("org_id", orgId)
    .single();

  if (!data || data.status !== "active") return "free";
  return data.plan_id as BillingPlan;
}

/** Check if the org can create a new approval request */
export async function canCreateRequest(orgId: string): Promise<EnforcementResult> {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  if (isUnlimited(limits.maxRequests)) {
    return { allowed: true, plan };
  }

  const admin = createAdminClient();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await admin
    .from("approval_requests")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", periodStart);

  const current = count ?? 0;

  if (current >= limits.maxRequests) {
    return {
      allowed: false,
      reason: `Monthly request limit reached (${limits.maxRequests}). Upgrade to Pro for unlimited requests.`,
      limit: limits.maxRequests,
      current,
      plan,
      upgradeRequired: true,
    };
  }

  return { allowed: true, limit: limits.maxRequests, current, plan };
}

/** Check if the org can create a new connection */
export async function canCreateConnection(orgId: string): Promise<EnforcementResult> {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  if (isUnlimited(limits.maxConnections)) {
    return { allowed: true, plan };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("connections")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_active", true);

  const current = count ?? 0;

  if (current >= limits.maxConnections) {
    return {
      allowed: false,
      reason: `Connection limit reached (${limits.maxConnections}). Upgrade for more connections.`,
      limit: limits.maxConnections,
      current,
      plan,
      upgradeRequired: true,
    };
  }

  return { allowed: true, limit: limits.maxConnections, current, plan };
}

/** Check if the org can add a new team member */
export async function canAddTeamMember(orgId: string): Promise<EnforcementResult> {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  if (isUnlimited(limits.maxTeamMembers)) {
    return { allowed: true, plan };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("org_memberships")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const current = count ?? 0;

  if (current >= limits.maxTeamMembers) {
    return {
      allowed: false,
      reason: `Team member limit reached (${limits.maxTeamMembers}). Upgrade for more seats.`,
      limit: limits.maxTeamMembers,
      current,
      plan,
      upgradeRequired: true,
    };
  }

  return { allowed: true, limit: limits.maxTeamMembers, current, plan };
}

/** Check if a specific feature is available on the org's plan */
export async function canUseFeature(orgId: string, feature: string): Promise<EnforcementResult> {
  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  if (limits.features.includes(feature)) {
    return { allowed: true, plan };
  }

  return {
    allowed: false,
    reason: `${feature.replace(/_/g, " ")} is not available on the ${limits.name} plan.`,
    plan,
    upgradeRequired: true,
  };
}

/** Get the org's current usage summary */
export async function getUsageSummary(orgId: string) {
  const admin = createAdminClient();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: requestsThisMonth },
    { count: connectionsCount },
    { count: membersCount },
  ] = await Promise.all([
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", periodStart),
    admin
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
    admin
      .from("org_memberships")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);

  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  return {
    plan,
    limits,
    usage: {
      requests: requestsThisMonth ?? 0,
      connections: connectionsCount ?? 0,
      teamMembers: membersCount ?? 0,
    },
  };
}
