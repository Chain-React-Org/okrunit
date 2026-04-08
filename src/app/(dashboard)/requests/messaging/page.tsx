import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { MessagingConnectionsPage } from "@/components/messaging/messaging-connections-page";
import { WebhookChannels } from "@/components/messaging/webhook-channels";
import type { ApprovalFlow, MessagingConnection } from "@/lib/types/database";
import type { WebhookChannel } from "@/components/messaging/webhook-channels";

export const metadata = {
  title: "Messaging Channels - OKrunit",
  description:
    "Connect messaging platforms to receive approval notifications with interactive approve/reject buttons.",
};

export default async function MessagingPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin")
    redirect("/requests");

  const admin = createAdminClient();

  const [{ data: connections }, { data: flows }, { data: webhookChannels }] =
    await Promise.all([
      admin
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
      admin
        .from("webhook_notification_channels")
        .select("*")
        .eq("org_id", membership.org_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .returns<WebhookChannel[]>(),
    ]);

  return (
    <div className="space-y-10">
      <MessagingConnectionsPage
        connections={connections ?? []}
        flows={flows ?? []}
      />

      {/* Custom Webhooks section */}
      <div className="border-t pt-8">
        <WebhookChannels initialChannels={webhookChannels ?? []} />
      </div>
    </div>
  );
}
