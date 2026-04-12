import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedOrgLayoutData } from "@/lib/cache/queries";
import { AuditLogClient } from "@/components/audit/audit-log-client";
import { TierLimitBanner } from "@/components/ui/tier-limit-banner";
import { PLAN_LIMITS, hasFeature } from "@/lib/billing/plans";

export const metadata = {
  title: "Audit Log - OKrunit",
  description: "View a chronological log of all actions in your organization.",
};

export default async function AuditLogPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const { currentPlan } = await getCachedOrgLayoutData(ctx.membership.org_id);
  const showBanner = !hasFeature(currentPlan, "audit_log_export");

  return (
    <div>
      {showBanner && (
        <div className="mb-6">
          <TierLimitBanner
            dismissKey="audit-log-limit"
            planName={PLAN_LIMITS[currentPlan].name}
            message="does not include audit log export. View logs here, but exporting requires a Business plan or higher."
          />
        </div>
      )}
      <AuditLogClient orgId={ctx.membership.org_id} />
    </div>
  );
}
