// ---------------------------------------------------------------------------
// OKRunit -- Teams Management Dashboard Page
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";

import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamList } from "@/components/teams/team-list";
import { PageContainer } from "@/components/ui/page-container";

export const metadata = {
  title: "Teams - OKRunit",
  description: "Manage teams within your organization.",
};

export default async function TeamsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const { membership, org } = ctx;

  // Only admins and owners can manage teams.
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch all teams for this org
  const { data: teams } = await admin
    .from("teams")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("name");

  // Fetch team member counts
  const teamIds = (teams ?? []).map((t) => t.id);
  const { data: teamMemberships } = await admin
    .from("team_memberships")
    .select("team_id")
    .in("team_id", teamIds.length > 0 ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

  // Build a map of team_id -> member count
  const memberCountMap: Record<string, number> = {};
  for (const tm of teamMemberships ?? []) {
    memberCountMap[tm.team_id] = (memberCountMap[tm.team_id] ?? 0) + 1;
  }

  // Fetch org memberships (for the add-member picker in the dialog)
  const { data: orgMemberships } = await admin
    .from("org_memberships")
    .select("user_id, role, can_approve")
    .eq("org_id", membership.org_id);

  // Fetch user profiles for org members
  const userIds = (orgMemberships ?? []).map((m) => m.user_id);
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  // Combine into the shape the component expects
  const orgMembers = (orgMemberships ?? []).map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.user_id,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: m.role as "owner" | "admin" | "member",
      can_approve: m.can_approve,
    };
  });

  // Fetch current team memberships so the component knows who is already in each team
  const { data: allTeamMemberships } = await admin
    .from("team_memberships")
    .select("id, team_id, user_id, created_at")
    .in("team_id", teamIds.length > 0 ? teamIds : ["00000000-0000-0000-0000-000000000000"]);

  return (
    <PageContainer>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-muted-foreground text-sm">
            Manage teams within {org.name}.
          </p>
        </div>

        <TeamList
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
          currentUserId={ctx.profile.id}
          currentUserRole={membership.role}
        />
      </div>
    </PageContainer>
  );
}
