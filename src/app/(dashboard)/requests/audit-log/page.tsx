import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { AuditLogClient } from "@/components/audit/audit-log-client";

export const metadata = {
  title: "Audit Log - OKRunit",
  description: "View a chronological log of all actions in your organization.",
};

export default async function AuditLogPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  return <AuditLogClient orgId={ctx.membership.org_id} />;
}
