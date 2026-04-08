import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { AccountSettings } from "@/components/settings/account-settings";
import { SessionManagement } from "@/components/settings/session-management";
import type { NotificationSettings } from "@/lib/types/database";

export const metadata = {
  title: "Account Settings - OKrunit",
  description: "Manage your profile, notifications, and account settings.",
};

export default async function AccountSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { profile } = ctx;

  const supabase = await createClient();

  const { data: notificationSettings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", profile.id)
    .single<NotificationSettings>();

  return (
    <>
      <PageHeader
        title="Account"
        description="Manage your profile, notifications, and account settings."
      />

      <AccountSettings
        userId={profile.id}
        initialFullName={profile.full_name ?? ""}
        initialEmail={profile.email}
        initialAvatarUrl={profile.avatar_url}
        notificationSettings={notificationSettings ?? null}
      />

      <div className="mt-8 rounded-xl border border-border/50 bg-[var(--card)] p-5">
        <SessionManagement />
      </div>
    </>
  );
}
