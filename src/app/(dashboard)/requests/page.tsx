import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedRequestsData } from "@/lib/cache/queries";
import { ApprovalDashboard } from "@/components/approvals/approval-dashboard";

export const metadata = {
  title: "Requests - OKrunit",
  description: "View and manage approval requests.",
};

export default async function RequestsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, org } = ctx;

  const { approvalCreators, teamsMap } =
    await getCachedRequestsData(membership.org_id);

  return (
    <ApprovalDashboard
      approvalCreators={approvalCreators}
      teamsMap={teamsMap}
      canApprove={membership.can_approve ?? true}
      allowSelfApproval={org.allow_self_approval ?? false}
      canManageFlows={membership.can_manage_flows ?? false}
      orgId={membership.org_id}
      userId={membership.user_id}
      userRole={membership.role}
    />
  );
}
