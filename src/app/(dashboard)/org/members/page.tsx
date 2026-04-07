import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedMembersData, getCachedOrgLayoutData } from "@/lib/cache/queries";
import { V2MemberList } from "@/components/org/v2-member-list";
import { TierLimitBanner } from "@/components/ui/tier-limit-banner";
import { PLAN_LIMITS, isUnlimited } from "@/lib/billing/plans";

export const metadata = {
  title: "Members - OKrunit",
  description: "Manage your organization's team members.",
};

export default async function V2OrgMembersPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/org/overview");

  const [{ members, memberStats, pendingLoadMap }, { currentPlan }] = await Promise.all([
    getCachedMembersData(membership.org_id),
    getCachedOrgLayoutData(membership.org_id),
  ]);

  const limits = PLAN_LIMITS[currentPlan];
  const showBanner = !isUnlimited(limits.maxTeamMembers);

  return (
    <div>
      {showBanner && (
        <div className="mb-6">
          <TierLimitBanner
            dismissKey="members-limit"
            planName={limits.name}
            message={`supports up to ${limits.maxTeamMembers} team members (${members.length} active).`}
          />
        </div>
      )}
      <V2MemberList
        members={members}
        currentUserId={ctx.profile.id}
        currentUserRole={membership.role}
        memberStats={memberStats}
        pendingLoadMap={pendingLoadMap}
      />
    </div>
  );
}
