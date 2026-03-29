import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApprovalDashboard } from "@/components/approvals/approval-dashboard";
import type { CreatedByInfo } from "@/lib/types/database";

export const metadata = {
  title: "Requests - OKRunit",
  description: "View and manage approval requests.",
};

export default async function RequestsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  const admin = createAdminClient();
  const { data: approvals } = await admin
    .from("approval_requests")
    .select("id, created_by")
    .eq("org_id", membership.org_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Resolve creator names from created_by.user_id (set on all new requests)
  const creatorUserIds = new Set<string>();
  for (const a of approvals ?? []) {
    const cb = a.created_by as CreatedByInfo | null;
    if (cb?.user_id) creatorUserIds.add(cb.user_id);
  }

  let approvalCreators: Record<string, string> = {};
  if (creatorUserIds.size > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", [...creatorUserIds]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    for (const a of approvals ?? []) {
      const cb = a.created_by as CreatedByInfo | null;
      if (cb?.user_id) {
        const p = profileMap.get(cb.user_id);
        if (p) approvalCreators[a.id] = p.full_name || p.email;
      }
    }
  }

  return (
    <ApprovalDashboard
      approvalCreators={approvalCreators}
      canApprove={membership.can_approve ?? true}
      orgId={membership.org_id}
    />
  );
}
