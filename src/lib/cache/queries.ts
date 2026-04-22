// ---------------------------------------------------------------------------
// Cached data-fetching functions for use with Next.js cache components.
// Each function uses "use cache" and is tagged for granular invalidation.
// ---------------------------------------------------------------------------

import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags } from "./tags";
import type { OrgMembership, Organization, UserProfile } from "@/lib/types/database";
import type { BillingPlan } from "@/lib/types/database";
import { PLAN_LIMITS } from "@/lib/billing/plans";

// ---------------------------------------------------------------------------
// Org context (profile + membership + org), cached per user
// ---------------------------------------------------------------------------

export async function getCachedOrgData(userId: string) {
  "use cache";
  cacheTag(CacheTags.orgContext(userId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const [{ data: profile }, { data: membership }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single<UserProfile>(),
    admin
      .from("org_memberships")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .single<OrgMembership>(),
  ]);

  if (!profile || !membership) return null;

  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", membership.org_id)
    .single<Organization>();

  if (!org) return null;

  return { profile, membership, org };
}

// ---------------------------------------------------------------------------
// Dashboard layout data (user orgs + pending count)
// ---------------------------------------------------------------------------

export async function getCachedDashboardData(
  userId: string,
  orgId: string,
) {
  "use cache";
  cacheTag(
    CacheTags.dashboard(userId),
    CacheTags.requests(orgId),
    CacheTags.organizations(userId),
  );
  cacheLife("minutes");

  const admin = createAdminClient();

  // Inline getUserOrgs logic to keep everything in one cached function
  const [{ data: memberships }, { count: pendingCount }] = await Promise.all([
    admin
      .from("org_memberships")
      .select("id, org_id, role, is_default")
      .eq("user_id", userId)
      .order("is_default", { ascending: false }),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending")
      .eq("is_log", false)
      .is("archived_at", null),
  ]);

  let userOrgs: {
    id: string;
    org_id: string;
    org_name: string;
    role: string;
    is_default: boolean;
  }[] = [];

  if (memberships && memberships.length > 0) {
    const orgIds = memberships.map((m) => m.org_id);
    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .in("id", orgIds);

    const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));

    userOrgs = memberships.map((m) => ({
      id: m.id,
      org_id: m.org_id,
      org_name: orgMap.get(m.org_id) ?? "Unknown",
      role: m.role,
      is_default: m.is_default,
    }));
  }

  return { userOrgs, pendingCount: pendingCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Org layout data (subscription/plan)
// ---------------------------------------------------------------------------

export async function getCachedOrgLayoutData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.subscription(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();
  const [{ data: org }, { data: subscription }] = await Promise.all([
    admin.from("organizations").select("plan_override").eq("id", orgId).single(),
    admin.from("subscriptions").select("plan_id, status").eq("org_id", orgId).maybeSingle(),
  ]);

  const currentPlan = (org?.plan_override ?? subscription?.plan_id ?? "free") as BillingPlan;
  const baseName = PLAN_LIMITS[currentPlan]?.name ?? "Free";
  const planName = subscription?.status === "trialing" ? `${baseName} Trial` : baseName;

  return { currentPlan, planName };
}

// ---------------------------------------------------------------------------
// Overview page data
// ---------------------------------------------------------------------------

export async function getCachedOverviewData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.overview(orgId), CacheTags.requests(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const [
    { data: statusRows },
    { count: connectionCount },
    { count: memberCount },
    { data: recentActivity },
    { count: slaBreachedCount },
    { count: escalatedCount },
  ] = await Promise.all([
    admin
      .from("approval_requests")
      .select("status")
      .eq("org_id", orgId)
      .in("status", ["pending", "approved", "rejected"]),
    admin
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    admin
      .from("org_memberships")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    admin
      .from("approval_requests")
      .select("id, title, status, priority, action_type, source, created_at, decided_at, connection_id, created_by")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending")
      .eq("sla_breached", true),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "pending")
      .gt("escalation_level", 0),
  ]);

  // Count statuses
  const statusCounts = { pending: 0, approved: 0, rejected: 0 };
  for (const row of statusRows ?? []) {
    if (row.status in statusCounts)
      statusCounts[row.status as keyof typeof statusCounts]++;
  }

  // Build connection + creator lookups
  const connectionIds = [
    ...new Set(
      (recentActivity ?? [])
        .map((a: Record<string, unknown>) => a.connection_id)
        .filter(Boolean) as string[]
    ),
  ];
  const creatorUserIds = [
    ...new Set(
      (recentActivity ?? [])
        .map((a: Record<string, unknown>) => (a.created_by as Record<string, unknown> | null)?.user_id)
        .filter(Boolean) as string[]
    ),
  ];

  const [connectionNameMap, creatorNameMap] = await Promise.all([
    connectionIds.length > 0
      ? admin
          .from("connections")
          .select("id, name")
          .in("id", connectionIds)
          .then(({ data }) =>
            Object.fromEntries((data ?? []).map((c) => [c.id, c.name]))
          )
      : Promise.resolve({} as Record<string, string>),
    creatorUserIds.length > 0
      ? admin
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", creatorUserIds)
          .then(({ data }) =>
            Object.fromEntries(
              (data ?? []).map((p) => [
                p.id,
                p.full_name || p.email || p.id.slice(0, 8),
              ])
            )
          )
      : Promise.resolve({} as Record<string, string>),
  ]);

  // ---------------------------------------------------------------------------
  // Analytics: 7-day window for decision time, SLA compliance, approval rate
  // ---------------------------------------------------------------------------
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentDecided },
    { data: prevDecided },
    { data: recentSlaRows },
    { data: prevSlaRows },
  ] = await Promise.all([
    // Current 7 days: decided requests with timestamps
    admin
      .from("approval_requests")
      .select("status, created_at, decided_at, sla_breached")
      .eq("org_id", orgId)
      .not("decided_at", "is", null)
      .gte("decided_at", sevenDaysAgo),
    // Previous 7 days: decided requests with timestamps
    admin
      .from("approval_requests")
      .select("status, created_at, decided_at, sla_breached")
      .eq("org_id", orgId)
      .not("decided_at", "is", null)
      .gte("decided_at", fourteenDaysAgo)
      .lt("decided_at", sevenDaysAgo),
    // Current 7 days: all requests for SLA compliance
    admin
      .from("approval_requests")
      .select("sla_breached")
      .eq("org_id", orgId)
      .gte("created_at", sevenDaysAgo),
    // Previous 7 days: all requests for SLA compliance
    admin
      .from("approval_requests")
      .select("sla_breached")
      .eq("org_id", orgId)
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", sevenDaysAgo),
  ]);

  // Avg decision time (minutes) for current and previous periods
  function avgDecisionMinutes(rows: Array<{ created_at: string; decided_at: string }> | null): number {
    if (!rows || rows.length === 0) return 0;
    let totalMs = 0;
    for (const r of rows) {
      totalMs += new Date(r.decided_at).getTime() - new Date(r.created_at).getTime();
    }
    return Math.round(totalMs / rows.length / 60000);
  }

  const currentAvgDecisionMin = avgDecisionMinutes(
    (recentDecided ?? []) as Array<{ created_at: string; decided_at: string }>,
  );
  const prevAvgDecisionMin = avgDecisionMinutes(
    (prevDecided ?? []) as Array<{ created_at: string; decided_at: string }>,
  );

  // SLA compliance
  const currentSlaTotal = (recentSlaRows ?? []).length;
  const currentSlaCompliant = (recentSlaRows ?? []).filter(
    (r) => !r.sla_breached,
  ).length;
  const currentSlaRate =
    currentSlaTotal > 0 ? Math.round((currentSlaCompliant / currentSlaTotal) * 100) : 100;

  const prevSlaTotal = (prevSlaRows ?? []).length;
  const prevSlaCompliant = (prevSlaRows ?? []).filter(
    (r) => !r.sla_breached,
  ).length;
  const prevSlaRate =
    prevSlaTotal > 0 ? Math.round((prevSlaCompliant / prevSlaTotal) * 100) : 100;

  // 7-day approval rate
  const recentApproved = (recentDecided ?? []).filter(
    (r) => r.status === "approved",
  ).length;
  const recentDecidedCount = (recentDecided ?? []).length;
  const recentApprovalRate =
    recentDecidedCount > 0 ? Math.round((recentApproved / recentDecidedCount) * 100) : 0;

  const prevApproved = (prevDecided ?? []).filter(
    (r) => r.status === "approved",
  ).length;
  const prevDecidedCount = (prevDecided ?? []).length;
  const prevApprovalRate =
    prevDecidedCount > 0 ? Math.round((prevApproved / prevDecidedCount) * 100) : 0;

  return {
    statusCounts,
    connectionCount: connectionCount ?? 0,
    memberCount: memberCount ?? 0,
    recentActivity: recentActivity ?? [],
    slaBreachedCount: slaBreachedCount ?? 0,
    escalatedCount: escalatedCount ?? 0,
    connectionNameMap,
    creatorNameMap,
    // Analytics
    analytics: {
      avgDecisionMinutes: currentAvgDecisionMin,
      prevAvgDecisionMinutes: prevAvgDecisionMin,
      slaComplianceRate: currentSlaRate,
      prevSlaComplianceRate: prevSlaRate,
      pendingCount: statusCounts.pending,
      approvalRate7d: recentApprovalRate,
      prevApprovalRate7d: prevApprovalRate,
    },
  };
}

// ---------------------------------------------------------------------------
// Members page data
// ---------------------------------------------------------------------------

export async function getCachedMembersData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.members(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const { data: orgMemberships } = await admin
    .from("org_memberships")
    .select("id, user_id, org_id, role, can_approve, can_connect, created_at, updated_at")
    .eq("org_id", orgId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  const userIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const members = (orgMemberships ?? []).map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.user_id,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: m.role as "owner" | "admin" | "member",
      can_approve: m.can_approve ?? false,
      can_connect: m.can_connect ?? false,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: recentDecisions }, { data: pendingAssigned }] = await Promise.all([
    admin
      .from("approval_requests")
      .select("decided_by, decided_at, status")
      .eq("org_id", orgId)
      .not("decided_by", "is", null)
      .gte("decided_at", thirtyDaysAgo)
      .in("decided_by", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("approval_requests")
      .select("assigned_approvers, status")
      .eq("org_id", orgId)
      .eq("status", "pending"),
  ]);

  const memberStats: Record<string, { decisions_30d: number; approved: number; rejected: number; last_active: string | null }> = {};
  for (const uid of userIds) {
    memberStats[uid] = { decisions_30d: 0, approved: 0, rejected: 0, last_active: null };
  }
  for (const d of recentDecisions ?? []) {
    if (!d.decided_by) continue;
    const stat = memberStats[d.decided_by];
    if (!stat) continue;
    stat.decisions_30d++;
    if (d.status === "approved") stat.approved++;
    if (d.status === "rejected") stat.rejected++;
    if (!stat.last_active || (d.decided_at && d.decided_at > stat.last_active)) {
      stat.last_active = d.decided_at;
    }
  }

  const pendingLoadMap: Record<string, number> = {};
  for (const req of pendingAssigned ?? []) {
    const approvers: string[] = req.assigned_approvers ?? [];
    for (const uid of approvers) {
      pendingLoadMap[uid] = (pendingLoadMap[uid] ?? 0) + 1;
    }
  }

  return { members, memberStats, pendingLoadMap };
}

// ---------------------------------------------------------------------------
// Teams page data
// ---------------------------------------------------------------------------

export async function getCachedTeamsData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.teams(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const { data: teams } = await admin
    .from("teams")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  const teamIds = (teams ?? []).map((t) => t.id);

  const { data: teamMembershipsData } = await admin
    .from("team_memberships")
    .select("team_id")
    .in("team_id", teamIds.length > 0 ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

  const memberCountMap: Record<string, number> = {};
  for (const tm of teamMembershipsData ?? []) {
    memberCountMap[tm.team_id] = (memberCountMap[tm.team_id] ?? 0) + 1;
  }

  return {
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      created_at: t.created_at,
      updated_at: t.updated_at,
    })),
    memberCounts: memberCountMap,
  };
}

// ---------------------------------------------------------------------------
// Roles page data
// ---------------------------------------------------------------------------

export async function getCachedRolesData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.roles(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("custom_roles")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  return roles ?? [];
}

// ---------------------------------------------------------------------------
// Subscription/billing page data
// ---------------------------------------------------------------------------

export async function getCachedSubscriptionData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.subscription(orgId), CacheTags.requests(orgId), CacheTags.connections(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const [
    { data: org },
    { data: plans },
    { data: subscription },
    { count: requestsThisMonth },
    { count: apiKeyConnectionsCount },
    { count: membersCount },
    { count: teamsCount },
    { data: invoices },
  ] = await Promise.all([
    admin.from("organizations").select("plan_override").eq("id", orgId).single(),
    admin.from("plans").select("*").eq("is_active", true).order("sort_order"),
    admin.from("subscriptions").select("*").eq("org_id", orgId).single(),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    admin.from("connections").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true),
    admin.from("org_memberships").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("teams").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    admin.from("invoices").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
  ]);

  return {
    plans: plans ?? [],
    subscription,
    planOverride: (org?.plan_override ?? null) as BillingPlan | null,
    requestsThisMonth: requestsThisMonth ?? 0,
    apiKeyConnectionsCount: apiKeyConnectionsCount ?? 0,
    membersCount: membersCount ?? 0,
    teamsCount: teamsCount ?? 0,
    invoices: invoices ?? [],
  };
}

// ---------------------------------------------------------------------------
// Organizations page data
// ---------------------------------------------------------------------------

export async function getCachedOrganizationsData(userId: string) {
  "use cache";
  cacheTag(CacheTags.organizations(userId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const { data: memberships } = await admin
    .from("org_memberships")
    .select("id, org_id, role, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });

  if (!memberships || memberships.length === 0)
    return { orgs: [], memberCounts: {}, teamCounts: {} };

  const orgIds = memberships.map((m) => m.org_id);

  const [{ data: orgs }, { data: memberRows }, { data: teamRows }] =
    await Promise.all([
      admin.from("organizations").select("id, name").in("id", orgIds),
      admin
        .from("org_memberships")
        .select("org_id")
        .in("org_id", orgIds),
      admin
        .from("teams")
        .select("org_id")
        .in("org_id", orgIds),
    ]);

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const userOrgs = memberships.map((m) => ({
    id: m.id,
    org_id: m.org_id,
    org_name: orgMap.get(m.org_id) ?? "Unknown",
    role: m.role,
    is_default: m.is_default,
  }));

  const memberCounts: Record<string, number> = {};
  for (const row of memberRows ?? []) {
    memberCounts[row.org_id] = (memberCounts[row.org_id] ?? 0) + 1;
  }

  const teamCounts: Record<string, number> = {};
  for (const row of teamRows ?? []) {
    teamCounts[row.org_id] = (teamCounts[row.org_id] ?? 0) + 1;
  }

  return { orgs: userOrgs, memberCounts, teamCounts };
}

// ---------------------------------------------------------------------------
// Requests page data
// ---------------------------------------------------------------------------

export async function getCachedRequestsData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.requests(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const { data: approvals } = await admin
    .from("approval_requests")
    .select("id, created_by")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const creatorUserIds = new Set<string>();
  for (const a of approvals ?? []) {
    const cb = a.created_by as Record<string, unknown> | null;
    if (cb?.user_id) creatorUserIds.add(cb.user_id as string);
  }

  const creators: Record<string, string> = {};
  if (creatorUserIds.size > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", [...creatorUserIds]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const a of approvals ?? []) {
      const cb = a.created_by as Record<string, unknown> | null;
      if (cb?.user_id) {
        const p = profileMap.get(cb.user_id as string);
        if (p) creators[a.id] = p.full_name || p.email;
      }
    }
  }

  const { data: teams } = await admin
    .from("teams")
    .select("id, name")
    .eq("org_id", orgId);

  const teamsMap: Record<string, string> = {};
  for (const t of teams ?? []) {
    teamsMap[t.id] = t.name;
  }

  return { approvalCreators: creators, teamsMap };
}

// ---------------------------------------------------------------------------
// Analytics page data
// ---------------------------------------------------------------------------

export async function getCachedAnalyticsData(orgId: string, days: number = 30) {
  "use cache";
  cacheTag(CacheTags.analytics(orgId), CacheTags.requests(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const prevPeriodStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalCount },
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: prevTotalCount },
    { count: prevPendingCount },
    { count: prevApprovedCount },
    { count: prevRejectedCount },
    { data: volumeData },
    { data: decisionData },
    { data: responseTimeData },
  ] = await Promise.all([
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending").gte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "approved").gte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "rejected").gte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", prevPeriodStart).lte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending").gte("created_at", prevPeriodStart).lte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "approved").gte("created_at", prevPeriodStart).lte("created_at", periodStart),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "rejected").gte("created_at", prevPeriodStart).lte("created_at", periodStart),
    admin.from("approval_requests").select("created_at").eq("org_id", orgId).gte("created_at", periodStart).order("created_at"),
    admin.from("approval_requests").select("status, decided_at").eq("org_id", orgId).not("decided_at", "is", null).gte("decided_at", periodStart),
    admin.from("approval_requests").select("created_at, decided_at").eq("org_id", orgId).not("decided_at", "is", null).gte("created_at", periodStart),
  ]);

  return {
    totalCount: totalCount ?? 0,
    pendingCount: pendingCount ?? 0,
    approvedCount: approvedCount ?? 0,
    rejectedCount: rejectedCount ?? 0,
    prevTotalCount: prevTotalCount ?? 0,
    prevPendingCount: prevPendingCount ?? 0,
    prevApprovedCount: prevApprovedCount ?? 0,
    prevRejectedCount: prevRejectedCount ?? 0,
    volumeData: volumeData ?? [],
    decisionData: decisionData ?? [],
    responseTimeData: responseTimeData ?? [],
  };
}

// ---------------------------------------------------------------------------
// Connections page data
// ---------------------------------------------------------------------------

export async function getCachedConnectionsData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.connections(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();
  const { data: connections } = await admin
    .from("connections")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return connections ?? [];
}

// ---------------------------------------------------------------------------
// Rules page data
// ---------------------------------------------------------------------------

export async function getCachedRulesData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.rules(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const [{ data: rules }, { data: teams }, { data: connections }, { data: memberRows }, { data: requestMeta }] =
    await Promise.all([
      admin
        .from("approval_rules")
        .select("*")
        .eq("org_id", orgId)
        .order("priority"),
      admin.from("teams").select("id, name").eq("org_id", orgId),
      admin.from("connections").select("id, name").eq("org_id", orgId),
      admin.from("org_memberships").select("user_id").eq("org_id", orgId),
      admin.from("approval_requests").select("action_type, source, title").eq("org_id", orgId).limit(500),
    ]);

  // Fetch profiles for org members
  const memberUserIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: members } = memberUserIds.length > 0
    ? await admin.from("user_profiles").select("id, full_name, email").in("id", memberUserIds).order("full_name")
    : { data: [] };


  // Extract distinct values for rule form dropdowns
  const actionTypes = [...new Set((requestMeta ?? []).map((r) => r.action_type).filter(Boolean))].sort() as string[];
  const sources = [...new Set((requestMeta ?? []).map((r) => r.source).filter(Boolean))].sort() as string[];
  const titles = [...new Set((requestMeta ?? []).map((r) => r.title).filter(Boolean))].sort() as string[];

  return {
    rules: rules ?? [],
    teams: teams ?? [],
    connections: connections ?? [],
    members: members ?? [],
    actionTypes,
    sources,
    titles,
  };
}

// ---------------------------------------------------------------------------
// Routes page data
// ---------------------------------------------------------------------------

export async function getCachedRoutesData(orgId: string) {
  "use cache";
  cacheTag(CacheTags.routes(orgId));
  cacheLife("minutes");

  const admin = createAdminClient();

  const [
    { data: flows },
    { data: teams },
    { data: approverMemberships },
    { data: positions },
  ] = await Promise.all([
    admin
      .from("approval_flows")
      .select("*")
      .eq("org_id", orgId)
      .order("last_request_at", { ascending: false, nullsFirst: false }),
    admin.from("teams").select("id, name").eq("org_id", orgId),
    admin
      .from("org_memberships")
      .select("user_id, role, can_approve")
      .eq("org_id", orgId),
    admin.from("team_positions").select("*").eq("org_id", orgId),
  ]);

  const approverUserIds = (approverMemberships ?? []).map((m) => m.user_id);
  let approverProfiles: Record<string, string> = {};
  let approverEmails: Record<string, string> = {};
  if (approverUserIds.length > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", approverUserIds);

    approverProfiles = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name || p.email || p.id.slice(0, 8)])
    );
    approverEmails = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.email ?? ""])
    );
  }

  return {
    flows: flows ?? [],
    teams: teams ?? [],
    approverMemberships: approverMemberships ?? [],
    approverProfiles,
    approverEmails,
    positions: positions ?? [],
  };
}
