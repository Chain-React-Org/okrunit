import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { NotificationDeliveryLog } from "@/components/audit/notification-delivery-log";

export const metadata = {
  title: "Notification Delivery - OKrunit",
  description: "View notification delivery events for your organization.",
};

export default async function NotificationDeliveryPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  return (
    <div>
      <NotificationDeliveryLog orgId={ctx.membership.org_id} />
    </div>
  );
}
