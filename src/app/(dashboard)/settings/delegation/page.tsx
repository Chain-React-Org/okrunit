import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layout/page-header";
import { DelegationSettings } from "@/components/settings/delegation-settings";
import { titleCaseName } from "@/lib/format-name";
import type { ApprovalDelegation, ApprovalFlow } from "@/lib/types/database";

function resolveDisplayName(
  profile: { full_name: string | null; email: string } | undefined,
  fallbackId: string,
): string {
  if (profile?.full_name) return titleCaseName(profile.full_name);
  if (profile?.email) return profile.email;
  return fallbackId.slice(0, 8);
}

export const metadata = {
  title: "Delegation - OKrunit",
  description: "Hand off approval requests to a teammate while you're away.",
};

export default async function DelegationSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, profile } = ctx;

  const admin = createAdminClient();

  // Load in parallel: delegations (sent + received), eligible delegates, and
  // flows where the current user is a responsible approver.
  const [
    { data: delegations },
    { data: memberRows },
    { data: flowsRaw },
  ] = await Promise.all([
    admin
      .from("approval_delegations")
      .select("*")
      .eq("org_id", membership.org_id)
      .or(`delegator_id.eq.${profile.id},delegate_id.eq.${profile.id}`)
      .order("created_at", { ascending: false }),
    admin
      .from("org_memberships")
      .select("user_id, role, can_approve")
      .eq("org_id", membership.org_id)
      .eq("can_approve", true),
    admin
      .from("approval_flows")
      .select("id, name, source, source_id, assigned_approvers, assigned_team_id, required_role, is_configured, last_request_at")
      .eq("org_id", membership.org_id),
  ]);

  // Profiles for everyone we'll show: all approvers + anyone referenced in
  // existing delegations (they might not currently be an approver).
  const userIds = new Set<string>();
  for (const m of memberRows ?? []) userIds.add(m.user_id);
  for (const d of delegations ?? []) {
    userIds.add(d.delegator_id);
    userIds.add(d.delegate_id);
  }
  userIds.delete(profile.id);

  let profilesById = new Map<string, { id: string; full_name: string | null; email: string }>();
  if (userIds.size > 0) {
    const { data: profileRows } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", [...userIds]);
    profilesById = new Map(
      (profileRows ?? []).map((p) => [p.id, p]),
    );
  }

  // Eligible delegates: approvers minus the current user, with name/email.
  const eligibleDelegates = (memberRows ?? [])
    .filter((m: { user_id: string }) => m.user_id !== profile.id)
    .map((m: { user_id: string; role: string }) => {
      const p = profilesById.get(m.user_id);
      return {
        id: m.user_id,
        name: resolveDisplayName(p, m.user_id),
        email: p?.email ?? "",
        role: m.role,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Flows where the current user is directly assigned. Covers explicit
  // assignment via assigned_approvers; team/role-based assignment would
  // require extra joins which we can add later if needed.
  const responsibleFlows = ((flowsRaw ?? []) as ApprovalFlow[])
    .filter((f) => (f.assigned_approvers ?? []).includes(profile.id))
    .map((f) => ({
      id: f.id,
      name: f.name || `${f.source} / ${f.source_id}`,
      source: f.source,
      lastRequestAt: f.last_request_at,
      isConfigured: f.is_configured,
    }));

  // Annotate delegations with display names.
  const enriched = (delegations as ApprovalDelegation[] | null)?.map((d) => {
    const counterpartyId = d.delegator_id === profile.id ? d.delegate_id : d.delegator_id;
    const p = profilesById.get(counterpartyId);
    const counterparty = {
      id: counterpartyId,
      name: resolveDisplayName(p, counterpartyId),
      email: p?.email ?? "",
    };
    return {
      ...d,
      role: d.delegator_id === profile.id ? ("delegator" as const) : ("delegate" as const),
      counterparty,
    };
  }) ?? [];

  return (
    <>
      <PageHeader
        title="Delegation"
        description="Route your approval requests to a teammate while you're away. The original sequential order is preserved; your delegate simply decides on your behalf."
      />
      <DelegationSettings
        initialDelegations={enriched}
        eligibleDelegates={eligibleDelegates}
        responsibleFlows={responsibleFlows}
        currentUserId={profile.id}
      />
    </>
  );
}
