import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { TemplatesPage } from "@/components/templates/templates-page";

export const metadata = {
  title: "Templates - OKrunit",
  description: "Manage approval templates to speed up your workflows.",
};

export default async function TemplatesRoute() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect("/requests");
  }

  return <TemplatesPage orgId={membership.org_id} />;
}
