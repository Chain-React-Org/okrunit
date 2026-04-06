import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedMembersData } from "@/lib/cache/queries";
import { V2MemberList } from "@/components/org/v2-member-list";

export const metadata = {
  title: "Members - OKrunit",
  description: "Manage your organization's team members.",
};

export default async function V2OrgMembersPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/org/overview");

  const { members, memberStats, pendingLoadMap } =
    await getCachedMembersData(membership.org_id);

  return (
    <V2MemberList
      members={members}
      currentUserId={ctx.profile.id}
      currentUserRole={membership.role}
      memberStats={memberStats}
      pendingLoadMap={pendingLoadMap}
    />
  );
}
