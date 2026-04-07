import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { PageHeader } from "@/components/layout/page-header";
import { SafetySettings } from "@/components/settings/safety-settings";

export const metadata = {
  title: "Safety Settings - OKrunit",
  description: "Manage auto-approval controls and emergency stop.",
};

export default async function SafetySettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, org } = ctx;

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  return (
    <>
      <PageHeader
        title="Safety"
        description="Control auto-approval behavior and emergency stop settings."
      />

      <SafetySettings
        autoApprovalsPaused={org.auto_approvals_paused ?? false}
        emergencyStopActive={org.emergency_stop_active}
        emergencyStopActivatedAt={org.emergency_stop_activated_at}
        emergencyStopActivatedBy={org.emergency_stop_activated_by}
        orgId={org.id}
        isAdmin={isAdmin}
      />
    </>
  );
}
