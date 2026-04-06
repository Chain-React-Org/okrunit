import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Organization, UserProfile, OrgMembership } from "@/lib/types/database";
import type { OrgWithCounts, UserWithMemberships, SystemStats } from "@/lib/admin-types";

export async function getAdminData() {
  await connection();
  const admin = createAdminClient();

  const [
    orgsResult,
    usersResult,
    membershipsResult,
    totalApprovalsResult,
    pendingApprovalsResult,
    approvedResult,
    rejectedResult,
    connectionsResult,
    emergencyResult,
    subscriptionsResult,
  ] = await Promise.all([
    admin.from("organizations").select("*").order("created_at", { ascending: false }).returns<Organization[]>(),
    admin.from("user_profiles").select("*").order("created_at", { ascending: false }).returns<UserProfile[]>(),
    admin.from("org_memberships").select("*").returns<OrgMembership[]>(),
    admin.from("approval_requests").select("*", { count: "exact", head: true }),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    admin.from("connections").select("*", { count: "exact", head: true }).eq("is_active", true),
    admin.from("organizations").select("*", { count: "exact", head: true }).eq("emergency_stop_active", true),
    admin.from("subscriptions").select("org_id, plan_id, status"),
  ]);

  const orgs = orgsResult.data ?? [];
  const users = usersResult.data ?? [];
  const memberships = membershipsResult.data ?? [];

  const orgNameMap = new Map(orgs.map((o) => [o.id, o.name]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const memberCountMap = new Map<string, number>();
  const orgOwnerMap = new Map<string, { name: string | null; email: string }>();
  for (const m of memberships) {
    memberCountMap.set(m.org_id, (memberCountMap.get(m.org_id) ?? 0) + 1);
    if (m.role === "owner" && !orgOwnerMap.has(m.org_id)) {
      const ownerProfile = userMap.get(m.user_id);
      if (ownerProfile) {
        orgOwnerMap.set(m.org_id, { name: ownerProfile.full_name, email: ownerProfile.email });
      }
    }
  }

  const subscriptionMap = new Map<string, { plan_id: string; status: string }>();
  for (const sub of subscriptionsResult.data ?? []) {
    subscriptionMap.set(sub.org_id, { plan_id: sub.plan_id, status: sub.status });
  }

  const [approvalCountsResult, connectionCountsResult] = await Promise.all([
    admin.from("approval_requests").select("org_id"),
    admin.from("connections").select("org_id").eq("is_active", true),
  ]);

  const approvalCountMap = new Map<string, number>();
  for (const row of approvalCountsResult.data ?? []) {
    approvalCountMap.set(row.org_id, (approvalCountMap.get(row.org_id) ?? 0) + 1);
  }

  const connectionCountMap = new Map<string, number>();
  for (const row of connectionCountsResult.data ?? []) {
    connectionCountMap.set(row.org_id, (connectionCountMap.get(row.org_id) ?? 0) + 1);
  }

  const organizations: OrgWithCounts[] = orgs.map((org) => {
    const owner = orgOwnerMap.get(org.id);
    const sub = subscriptionMap.get(org.id);
    return {
      ...org,
      member_count: memberCountMap.get(org.id) ?? 0,
      approval_count: approvalCountMap.get(org.id) ?? 0,
      connection_count: connectionCountMap.get(org.id) ?? 0,
      owner_name: owner?.name ?? null,
      owner_email: owner?.email ?? null,
      subscription_plan: sub?.plan_id ?? null,
      subscription_status: sub?.status ?? null,
    };
  });

  const usersWithMemberships: UserWithMemberships[] = users.map((user) => {
    const userMemberships = memberships
      .filter((m) => m.user_id === user.id)
      .map((m) => ({
        org_id: m.org_id,
        org_name: orgNameMap.get(m.org_id) ?? "Unknown",
        role: m.role,
      }));
    return { ...user, memberships: userMemberships };
  });

  const systemStats: SystemStats = {
    total_orgs: orgs.length,
    total_users: users.length,
    total_approvals: totalApprovalsResult.count ?? 0,
    pending_approvals: pendingApprovalsResult.count ?? 0,
    approved_count: approvedResult.count ?? 0,
    rejected_count: rejectedResult.count ?? 0,
    active_connections: connectionsResult.count ?? 0,
    emergency_stops_active: emergencyResult.count ?? 0,
  };

  return { organizations, users: usersWithMemberships, systemStats };
}
