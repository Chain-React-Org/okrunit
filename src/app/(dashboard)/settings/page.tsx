import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Shield } from "lucide-react";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import type { NotificationSettings } from "@/lib/types/database";

export const metadata = {
  title: "Settings - OKRunit",
  description: "Manage your notification preferences and account settings.",
};

export default async function SettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { profile, membership } = ctx;
  const isAdmin = membership.role === "owner" || membership.role === "admin";

  const supabase = await createClient();

  const { data: notificationSettings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", profile.id)
    .single<NotificationSettings>();

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your notification preferences and account settings."
      />

      <NotificationSettingsForm initialSettings={notificationSettings ?? null} />

      {isAdmin && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <KeyRound className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">OAuth Apps</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage OAuth 2.0 applications for one-click platform integrations.
                  </p>
                </div>
              </div>
              <Link
                href="/settings/oauth"
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Manage
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <Shield className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">Single Sign-On (SSO)</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure SAML-based SSO so your team can log in with your identity provider.
                  </p>
                </div>
              </div>
              <Link
                href="/settings/sso"
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Configure
              </Link>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
