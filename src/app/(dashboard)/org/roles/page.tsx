import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedRolesData } from "@/lib/cache/queries";
import { CustomRolesManager } from "@/components/org/custom-roles-manager";

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

  const roles = await getCachedRolesData(membership.org_id);

  return <CustomRolesManager initialRoles={roles} />;
}
