import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ApprovalDashboard } from "@/components/approvals/approval-dashboard";
import type { ApprovalRequest, Connection, UserProfile } from "@/lib/types/database";

export const metadata = {
  title: "Requests - OKRunit",
  description: "View and manage approval requests.",
};

export default async function RequestsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  const supabase = await createClient();

  const { data: approvals } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("org_id", membership.org_id)
    .is("archived_at", null)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ApprovalRequest[]>();

  const { data: connections } = await supabase
    .from("connections")
    .select("*")
    .eq("org_id", membership.org_id)
    .eq("is_active", true)
    .order("name")
    .returns<Connection[]>();

  const approvalCreators: Record<string, string> = {};
  const allApprovals = approvals ?? [];
  const allConnections = connections ?? [];

  const userIdsToResolve = new Set<string>();

  const connectionCreatorMap = new Map<string, string>();
  for (const conn of allConnections) {
    if (conn.created_by) {
      connectionCreatorMap.set(conn.id, conn.created_by);
      userIdsToResolve.add(conn.created_by);
    }
  }

  for (const approval of allApprovals) {
    if (approval.created_by?.user_id) {
      userIdsToResolve.add(approval.created_by.user_id);
    }
  }

  if (userIdsToResolve.size > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", [...userIdsToResolve])
      .returns<Pick<UserProfile, "id" | "full_name" | "email">[]>();

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

    for (const approval of allApprovals) {
      if (approval.created_by?.user_id) {
        const name = profileMap.get(approval.created_by.user_id);
        if (name) approvalCreators[approval.id] = name;
      } else if (approval.connection_id && connectionCreatorMap.has(approval.connection_id)) {
        const userId = connectionCreatorMap.get(approval.connection_id)!;
        const name = profileMap.get(userId);
        if (name) approvalCreators[approval.id] = name;
      }
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Requests"
        description="View and manage approval requests across your organization."
      />
      <ApprovalDashboard
        initialApprovals={approvals ?? []}
        connections={connections ?? []}
        approvalCreators={approvalCreators}
        canApprove={membership.can_approve ?? true}
        orgId={membership.org_id}
      />
    </PageContainer>
  );
}
