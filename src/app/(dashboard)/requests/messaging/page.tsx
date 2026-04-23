import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedOrgLayoutData } from "@/lib/cache/queries";
import { MessagingConnectionsPage } from "@/components/messaging/messaging-connections-page";
import { MyMessagingIdentities } from "@/components/messaging/my-messaging-identities";
import { WebhookChannels } from "@/components/messaging/webhook-channels";
import { TierLimitBanner } from "@/components/ui/tier-limit-banner";
import { PLAN_LIMITS, hasFeature } from "@/lib/billing/plans";
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
  const { currentPlan } = await getCachedOrgLayoutData(membership.org_id);
  const showBanner = !hasFeature(currentPlan, "slack_notifications");

  const [
    { data: connections },
    { data: flows },
    { data: webhookChannels },
    { data: myIdentities },
  ] =
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
      admin
        .from("messaging_user_identities")
        .select("id, platform, external_user_id, external_username")
        .eq("org_id", membership.org_id)
        .eq("user_id", ctx.profile.id)
        .returns<{
          id: string;
          platform: "slack" | "teams" | "discord" | "telegram";
          external_user_id: string;
          external_username: string | null;
        }[]>(),
    ]);

  // Which platforms have at least one active connection in this org? Used
  // to disable "Link my X" when the org hasn't installed that platform yet.
  const platformAvailability = {
    slack: false,
    teams: false,
    discord: false,
    telegram: false,
  };
  for (const c of connections ?? []) {
    if (c.is_active && c.platform in platformAvailability) {
      platformAvailability[c.platform as keyof typeof platformAvailability] = true;
    }
  }

  return (
    <div className="space-y-10">
      {showBanner && (
        <TierLimitBanner
          dismissKey="messaging-limit"
          planName={PLAN_LIMITS[currentPlan].name}
          message="does not include Slack, Discord, or Teams notifications. Email notifications are included on all plans."
        />
      )}

      <MyMessagingIdentities
        initial={myIdentities ?? []}
        platformAvailability={platformAvailability}
      />

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
