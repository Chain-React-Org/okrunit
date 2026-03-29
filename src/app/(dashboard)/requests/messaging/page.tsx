import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MessagingConnectionsPage } from "@/components/messaging/messaging-connections-page";
import type { ApprovalFlow, MessagingConnection } from "@/lib/types/database";

export const metadata = {
  title: "Messaging Channels - OKRunit",
  description:
    "Connect messaging platforms to receive approval notifications with interactive approve/reject buttons.",
};

export default async function MessagingPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin")
    redirect("/requests");

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: connections }, { data: flows }] = await Promise.all([
    supabase
      .from("messaging_connections")
      .select(
        "id, org_id, platform, workspace_id, workspace_name, channel_id, channel_name, webhook_url, is_active, notify_on_create, notify_on_decide, priority_filter, routing_rules, installed_by, created_at, updated_at",
      )
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .returns<MessagingConnection[]>(),
    admin
      .from("approval_flows")
      .select("id, source")
      .eq("org_id", membership.org_id)
      .returns<Pick<ApprovalFlow, "id" | "source">[]>(),
  ]);

  return (
    <MessagingConnectionsPage
      connections={connections ?? []}
      flows={flows ?? []}
    />
  );
}
