import { redirect, notFound } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamDetail } from "@/components/org/team-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: team } = await admin.from("teams").select("name").eq("id", id).single();
  return {
    title: team ? `${team.name} - Teams - OKrunit` : "Team - OKrunit",
  };
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, profile } = ctx;

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  const admin = createAdminClient();

  // Fetch team
  const { data: team } = await admin
    .from("teams")
    .select("*")
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .single();

  if (!team) notFound();

  // Fetch team memberships, org memberships, positions in parallel
  const [{ data: teamMemberships }, { data: orgMemberships }, { data: positions }] = await Promise.all([
    admin
      .from("team_memberships")
      .select("id, team_id, user_id, position_id, is_lead, created_at")
      .eq("team_id", team.id),
    admin
      .from("org_memberships")
      .select("id, user_id, org_id, role, can_approve")
      .eq("org_id", membership.org_id),
    admin
      .from("team_positions")
      .select("id, name, created_at")
      .eq("team_id", team.id)
      .order("name"),
  ]);

  // Get all user IDs we need profiles for
  const allUserIds = new Set<string>();
  for (const m of orgMemberships ?? []) allUserIds.add(m.user_id);
  if (team.created_by) allUserIds.add(team.created_by);

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", allUserIds.size > 0 ? [...allUserIds] : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Build members list with profiles
  const teamMemberIds = new Set((teamMemberships ?? []).map((tm) => tm.user_id));

  const members = (teamMemberships ?? []).map((tm) => {
    const prof = profileMap.get(tm.user_id);
    const orgMem = (orgMemberships ?? []).find((m) => m.user_id === tm.user_id);
    return {
      id: tm.user_id,
      email: prof?.email ?? "",
      full_name: prof?.full_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      role: (orgMem?.role ?? "member") as "owner" | "admin" | "member",
      position_id: tm.position_id as string | null,
      is_lead: !!(tm as Record<string, unknown>).is_lead,
      joined_at: tm.created_at,
    };
  });

  // Check if current user is a team lead for this team
  const currentUserTeamMembership = (teamMemberships ?? []).find((tm) => tm.user_id === profile.id);
  const isTeamLead = !!(currentUserTeamMembership as Record<string, unknown> | undefined)?.is_lead;

  // Available org members (not yet in this team, excluding team owner)
  const availableMembers = (orgMemberships ?? [])
    .filter((m) => !teamMemberIds.has(m.user_id) && m.user_id !== team.created_by)
    .map((m) => {
      const prof = profileMap.get(m.user_id);
      return {
        id: m.user_id,
        email: prof?.email ?? "",
        full_name: prof?.full_name ?? null,
        role: m.role as "owner" | "admin" | "member",
      };
    });

  // Owner info
  const ownerProfile = team.created_by ? profileMap.get(team.created_by) : null;
  const owner = ownerProfile
    ? { id: team.created_by!, name: ownerProfile.full_name, email: ownerProfile.email, avatar_url: ownerProfile.avatar_url }
    : null;

  return (
    <TeamDetail
      team={{
        id: team.id,
        name: team.name,
        description: team.description,
        created_at: team.created_at,
      }}
      members={members}
      availableMembers={availableMembers}
      positions={(positions ?? []).map((p) => ({ id: p.id, name: p.name }))}
      owner={owner}
      currentUserId={profile.id}
      canManage={isAdmin || isTeamLead}
      isOrgAdmin={isAdmin}
    />
  );
}
