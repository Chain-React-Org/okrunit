import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedRoutesData } from "@/lib/cache/queries";
import { RoutesHub } from "@/components/routes/routes-hub";

export const metadata = {
  title: "Routes - OKrunit",
  description: "Configure approval flows and who must approve for each source.",
};

export default async function RoutesPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin")
    redirect("/requests");

  const {
    flows,
    teams,
    approverMemberships,
    approverProfiles,
    positions,
  } = await getCachedRoutesData(membership.org_id);

  const members = approverMemberships.map((m: { user_id: string; role: string }) => {
    const name = approverProfiles[m.user_id];
    return {
      id: m.user_id,
      name: name || m.user_id,
      email: "",
      role: m.role,
    };
  });

  // Build position names map for flows with position-based approval
  const positionIds = flows
    .map((f: Record<string, unknown>) => f.assigned_position_id)
    .filter((id: unknown): id is string => id != null);

  const positionsMap: Record<string, string> = {};
  for (const pos of positions) {
    if (positionIds.includes(pos.id)) {
      positionsMap[pos.id] = pos.name;
    }
  }

  return (
    <RoutesHub
      flows={flows}
      teams={teams}
      members={members}
      orgId={membership.org_id}
      positionsMap={positionsMap}
    />
  );
}
