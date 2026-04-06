import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedOrganizationsData } from "@/lib/cache/queries";
import { OrgList } from "@/components/org/org-list";

export const metadata = {
  title: "Organizations - OKrunit",
  description: "View and manage your organizations.",
};

export default async function OrganizationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { profile, membership } = ctx;

  const { orgs, memberCounts, teamCounts } =
    await getCachedOrganizationsData(profile.id);

  return (
    <OrgList
      orgs={orgs}
      currentOrgId={membership.org_id}
      memberCounts={memberCounts}
      teamCounts={teamCounts}
    />
  );
}
