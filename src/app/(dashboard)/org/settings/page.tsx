import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { V2OrgSettings } from "@/components/org/v2-org-settings";
import type { UserRole } from "@/lib/types/database";

export const metadata = {
  title: "Organization Settings - OKrunit",
  description: "Manage your organization settings.",
};

export default async function V2OrgSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, org } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/org/overview");

  return (
    <V2OrgSettings
      org={org}
      role={membership.role as UserRole}
    />
  );
}
