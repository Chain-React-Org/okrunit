import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedOrganizationsData, getCachedOrgLayoutData } from "@/lib/cache/queries";
import { OrgList } from "@/components/org/org-list";
import { PLAN_LIMITS } from "@/lib/billing/plans";

export const metadata = {
  title: "Organizations - OKrunit",
  description: "View and manage your organizations.",
};

export default async function OrganizationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { profile, membership } = ctx;

  const [{ orgs, memberCounts, teamCounts }, { currentPlan }] = await Promise.all([
    getCachedOrganizationsData(profile.id),
    getCachedOrgLayoutData(membership.org_id),
  ]);

  const limits = PLAN_LIMITS[currentPlan];
  const ownedCount = orgs.filter((o) => o.role === "owner").length;
  const canCreateOrg = limits.maxOrganizations === -1 || ownedCount < limits.maxOrganizations;

  return (
    <OrgList
      orgs={orgs}
      currentOrgId={membership.org_id}
      memberCounts={memberCounts}
      teamCounts={teamCounts}
      canCreateOrg={canCreateOrg}
      maxOrganizations={limits.maxOrganizations}
      planName={limits.name}
    />
  );
}
