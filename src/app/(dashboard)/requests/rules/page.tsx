import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedRulesData } from "@/lib/cache/queries";
import { RulesManager } from "@/components/rules/rules-manager";
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

  const { rules, teams, connections } =
    await getCachedRulesData(membership.org_id);

  return (
    <RulesManager
      initialRules={rules as ApprovalRule[]}
      teams={teams as { id: string; name: string }[]}
      connections={connections as { id: string; name: string }[]}
    />
  );
}
