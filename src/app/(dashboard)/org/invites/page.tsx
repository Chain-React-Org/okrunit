import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { V2InviteSection } from "@/components/org/v2-invite-form";
import type { OrgInvite } from "@/lib/types/database";

export const metadata = {
  title: "Invites - OKRunit",
  description: "Manage invitations to your organization.",
};

export default async function V2OrgInvitesPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/org/overview");

  const admin = createAdminClient();

  const [{ data: pendingInvites }, { data: teams }] = await Promise.all([
    admin
      .from("org_invites")
      .select("id, org_id, email, role, invited_by, expires_at, accepted_at, team_ids, created_at")
      .eq("org_id", membership.org_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .returns<Omit<OrgInvite, "token">[]>(),
    admin
      .from("teams")
      .select("id, name")
      .eq("org_id", membership.org_id)
      .order("name"),
  ]);

  const invites = (pendingInvites ?? []) as OrgInvite[];
  const orgTeams = (teams ?? []).map((t) => ({ id: t.id, name: t.name }));

  return <V2InviteSection invites={invites} teams={orgTeams} />;
}
