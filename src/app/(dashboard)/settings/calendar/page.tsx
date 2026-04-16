import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { getOrgContext } from "@/lib/org-context";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Calendar Settings - OKrunit",
  description: "Connect your calendar for automatic out-of-office delegation.",
};

export default async function CalendarSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Connect your calendar for automatic out-of-office delegation."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Calendar className="size-7 text-muted-foreground" />
            </div>
            <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wider">
              Coming Soon
            </Badge>
            <div className="space-y-2 max-w-md">
              <p className="text-base font-medium">Calendar Integration</p>
              <p className="text-sm text-muted-foreground">
                Connect your Google or Microsoft calendar to automatically
                delegate approvals when you have an out-of-office event.
                This feature is currently pending approval from Google and
                will be available shortly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
