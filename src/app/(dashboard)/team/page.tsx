import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TeamPageTabs } from "@/components/team/team-page-tabs";
import type { OrgInvite } from "@/lib/types/database";

export const metadata = {
  title: "Team - OKRunit",
  description: "Manage your organization's team members, invitations, and team groups.",
};

export default async function TeamPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, org } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();

  const { data: orgMemberships } = await admin
    .from("org_memberships")
    .select("id, user_id, org_id, role, can_approve, created_at, updated_at")
    .eq("org_id", membership.org_id)
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
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  });

  const { data: pendingInvites } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, invited_by, expires_at, accepted_at, created_at")
    .eq("org_id", membership.org_id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .returns<Omit<OrgInvite, "token">[]>();

  const canManageInvites = membership.role === "owner" || membership.role === "admin";

  const { data: teams } = await admin
    .from("teams")
    .select("*")
    .eq("org_id", membership.org_id)
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

  const orgMembers = (orgMemberships ?? []).map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.user_id,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: m.role as "owner" | "admin" | "member",
      can_approve: m.can_approve ?? false,
    };
  });

  const { data: allTeamMemberships } = await admin
    .from("team_memberships")
    .select("id, team_id, user_id, created_at")
    .in("team_id", teamIds.length > 0 ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

  // Fetch activity stats: recent decisions per member (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentDecisions } = await admin
    .from("approval_requests")
    .select("decided_by, decided_at, status")
    .eq("org_id", membership.org_id)
    .not("decided_by", "is", null)
    .gte("decided_at", thirtyDaysAgo)
    .in("decided_by", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  // Build activity stats per member
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

  // Fetch pending approval count assigned to each member
  const { data: pendingAssigned } = await admin
    .from("approval_requests")
    .select("assigned_approvers, status")
    .eq("org_id", membership.org_id)
    .eq("status", "pending");

  const pendingLoadMap: Record<string, number> = {};
  for (const req of pendingAssigned ?? []) {
    const approvers: string[] = req.assigned_approvers ?? [];
    for (const uid of approvers) {
      pendingLoadMap[uid] = (pendingLoadMap[uid] ?? 0) + 1;
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Team"
        description={`Manage members, invitations, and team groups for ${org.name}.`}
      />

      <TeamPageTabs
        members={members}
        currentUserId={ctx.profile.id}
        currentUserRole={membership.role}
        canManageInvites={canManageInvites}
        pendingInvites={(pendingInvites ?? []) as OrgInvite[]}
        teams={(teams ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }))}
        memberCounts={memberCountMap}
        teamMemberships={(allTeamMemberships ?? []).map((tm) => ({
          id: tm.id,
          team_id: tm.team_id,
          user_id: tm.user_id,
          created_at: tm.created_at,
        }))}
        orgMembers={orgMembers}
        org={org}
        memberCount={members.length}
        memberStats={memberStats}
        pendingLoadMap={pendingLoadMap}
      />
    </PageContainer>
  );
}
