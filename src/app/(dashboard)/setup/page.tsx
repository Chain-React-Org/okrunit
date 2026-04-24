import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/ui/page-container";
import { SetupWizard } from "@/components/onboarding/setup-wizard";
import type { MessagingConnection } from "@/lib/types/database";

export const metadata = {
  title: "Setup - OKrunit",
  description: "Set up your OKrunit organization.",
};

export default async function SetupPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const { org, profile } = ctx;

  // Users who already finished setup shouldn't see the wizard again.
  // Send them to the main dashboard instead.
  if (profile.setup_completed_at) redirect("/org/overview");

  const admin = createAdminClient();

  // Fetch connected messaging platforms and invite count for this org
  const [{ data: messagingConnections }, { count: inviteCount }] = await Promise.all([
    admin
      .from("messaging_connections")
      .select("platform, is_active")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .returns<Pick<MessagingConnection, "platform" | "is_active">[]>(),
    admin
      .from("org_invites")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id),
  ]);

  const connectedPlatforms = [
    ...new Set((messagingConnections ?? []).map((mc) => mc.platform)),
  ];

  // Auto-detect which steps are already complete from existing data
  const orgRenamed = org.name !== "My Organization";
  const hasInvites = (inviteCount ?? 0) > 0;
  const hasMessaging = connectedPlatforms.length > 0;

  // Determine the starting step: use DB value, but skip ahead if data exists.
  // Never auto-advance past step 2 (messaging) so the user can review
  // connected platforms and optionally connect more before finishing.
  let initialStep = profile.setup_wizard_step ?? 0;
  if (orgRenamed && initialStep < 1) initialStep = 1;
  if (hasInvites && initialStep < 2) initialStep = 2;
  if (hasMessaging && initialStep < 2) initialStep = 2;

  return (
    <PageContainer className="mx-auto max-w-2xl">
      <div className="space-y-2 pb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to OKrunit
        </h1>
        <p className="text-sm text-muted-foreground">
          Let&apos;s get your organization set up in a few quick steps.
        </p>
      </div>

      <SetupWizard
        orgId={org.id}
        orgName={org.name}
        connectedPlatforms={connectedPlatforms}
        initialStep={initialStep}
        orgRenamed={orgRenamed}
        hasInvites={hasInvites}
        hasMessaging={hasMessaging}
      />
    </PageContainer>
  );
}
