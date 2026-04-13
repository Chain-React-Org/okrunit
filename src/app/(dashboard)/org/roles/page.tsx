import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedRolesData, getCachedOrgLayoutData } from "@/lib/cache/queries";
import { CustomRolesManager } from "@/components/org/custom-roles-manager";
import { TierLimitBanner } from "@/components/ui/tier-limit-banner";
import { PLAN_LIMITS, hasFeature } from "@/lib/billing/plans";

export const metadata = {
  title: "Custom Roles - OKrunit",
  description: "Define custom roles for your organization.",
};

export default async function CustomRolesPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/org/overview");
  }

  const [roles, { currentPlan }] = await Promise.all([
    getCachedRolesData(membership.org_id),
    getCachedOrgLayoutData(membership.org_id),
  ]);

  const showBanner = !hasFeature(currentPlan, "custom_routing");

  return (
    <div>
      {showBanner && (
        <div className="mb-6">
          <TierLimitBanner
            dismissKey="custom-roles-limit"
            planName={PLAN_LIMITS[currentPlan].name}
            message="does not include custom roles. Custom roles let you define granular permissions beyond the default owner/admin/member roles."
          />
        </div>
      )}
      <CustomRolesManager initialRoles={roles} />
    </div>
  );
}
