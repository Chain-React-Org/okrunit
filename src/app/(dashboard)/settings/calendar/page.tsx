import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarSettings } from "@/components/settings/calendar-settings";

export const metadata = {
  title: "Calendar Settings - OKrunit",
  description: "Connect your calendar for automatic out-of-office delegation.",
};

export default async function CalendarSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { profile, org } = ctx;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Connect your calendar for automatic out-of-office delegation."
      />

      <CalendarSettings orgId={org.id} userId={profile.id} />
    </>
  );
}
