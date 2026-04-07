import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedRulesData, getCachedOrgLayoutData } from "@/lib/cache/queries";
import { RulesManager } from "@/components/rules/rules-manager";
import { TierLimitBanner } from "@/components/ui/tier-limit-banner";
import { PLAN_LIMITS, hasFeature } from "@/lib/billing/plans";
import type { ApprovalRule } from "@/lib/types/database";

export const metadata = {
  title: "Rules - OKrunit",
  description: "Manage conditional approval routing rules.",
};

export default async function RulesPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/requests");
  }

  const [{ rules, teams, connections }, { currentPlan }] = await Promise.all([
    getCachedRulesData(membership.org_id),
    getCachedOrgLayoutData(membership.org_id),
  ]);

  const showBanner = !hasFeature(currentPlan, "rules_engine");

  return (
    <div>
      {showBanner && (
        <div className="mb-6">
          <TierLimitBanner
            dismissKey="rules-limit"
            planName={PLAN_LIMITS[currentPlan].name}
            message="does not include the rules engine. Rules let you auto-approve, route, or escalate requests based on conditions."
          />
        </div>
      )}
      <RulesManager
        initialRules={rules as ApprovalRule[]}
        teams={teams as { id: string; name: string }[]}
        connections={connections as { id: string; name: string }[]}
      />
    </div>
  );
}
