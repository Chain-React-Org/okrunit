import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOAuthGrants } from "@/lib/api/oauth-grants";
import { getPlanLimits, isUnlimited, PLAN_ORDER } from "@/lib/billing/plans";
import type { BillingPlan } from "@/lib/types/database";

interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  plan?: BillingPlan;
  upgradeRequired?: boolean;
}

/** Get the org's current plan (plan_override takes precedence if set) */
export async function getOrgPlan(orgId: string): Promise<BillingPlan> {
  const admin = createAdminClient();

  // Check for admin plan override first
  const { data: org } = await admin
    .from("organizations")
    .select("plan_override")
    .eq("id", orgId)
    .single();

  if (org?.plan_override) {
    return org.plan_override as BillingPlan;
  }

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
  const [{ count: apiKeyCount }, oauthGrants] = await Promise.all([
    admin
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
    getActiveOAuthGrants(orgId),
  ]);

  const current = (apiKeyCount ?? 0) + oauthGrants.length;

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

/** Check if a user can create a new organization.
 *  Looks at the highest plan across all orgs the user owns to determine the limit. */
export async function canCreateOrganization(userId: string): Promise<EnforcementResult> {
  const admin = createAdminClient();

  // Get all orgs this user owns
  const { data: memberships } = await admin
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "owner");

  const ownedOrgIds = (memberships ?? []).map((m) => m.org_id);
  const currentCount = ownedOrgIds.length;

  // Find the highest plan across all owned orgs
  let bestPlan: BillingPlan = "free";
  for (const orgId of ownedOrgIds) {
    const plan = await getOrgPlan(orgId);
    if (PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(bestPlan)) {
      bestPlan = plan;
    }
  }

  const limits = getPlanLimits(bestPlan);

  if (isUnlimited(limits.maxOrganizations)) {
    return { allowed: true, plan: bestPlan };
  }

  if (currentCount >= limits.maxOrganizations) {
    return {
      allowed: false,
      reason: `Organization limit reached (${limits.maxOrganizations}). Upgrade to create more organizations.`,
      limit: limits.maxOrganizations,
      current: currentCount,
      plan: bestPlan,
      upgradeRequired: true,
    };
  }

  return { allowed: true, limit: limits.maxOrganizations, current: currentCount, plan: bestPlan };
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
    { count: apiKeyConnectionsCount },
    { count: membersCount },
    oauthGrants,
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
    getActiveOAuthGrants(orgId),
  ]);

  const plan = await getOrgPlan(orgId);
  const limits = getPlanLimits(plan);

  return {
    plan,
    limits,
    usage: {
      requests: requestsThisMonth ?? 0,
      connections: (apiKeyConnectionsCount ?? 0) + oauthGrants.length,
      teamMembers: membersCount ?? 0,
    },
  };
}
