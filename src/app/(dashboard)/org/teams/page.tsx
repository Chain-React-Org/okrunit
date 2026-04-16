import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getOrgPlan } from "@/lib/billing/enforce";
import { getCachedTeamsData } from "@/lib/cache/queries";
import { V2TeamList } from "@/components/org/v2-team-list";

export const metadata = {
  title: "Teams - OKrunit",
  description: "Manage team groups in your organization.",
};

export default async function V2OrgTeamsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  const [currentPlan, { teams, memberCounts }] = await Promise.all([
    getOrgPlan(membership.org_id),
    getCachedTeamsData(membership.org_id),
  ]);

  return (
    <V2TeamList
      teams={teams}
      memberCounts={memberCounts}
      currentUserRole={isAdmin ? membership.role : "member"}
      currentPlan={currentPlan}
    />
  );
}
