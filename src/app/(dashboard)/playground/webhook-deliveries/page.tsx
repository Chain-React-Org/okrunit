import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { DeliveryLogTable } from "@/components/webhooks/delivery-log-table";
import type { Connection, WebhookDeliveryLog } from "@/lib/types/database";

export const metadata = {
  title: "Webhook Deliveries - OKrunit",
  description: "View recent webhook delivery logs and their status.",
};

export default async function WebhookDeliveriesPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  const isAdmin = membership.role === "owner" || membership.role === "admin";
  if (!isAdmin) redirect("/playground/request-builder");

  const supabase = await createClient();

  const [{ data: deliveryLogs }, { data: allConnections }] = await Promise.all([
    supabase
      .from("webhook_delivery_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<WebhookDeliveryLog[]>(),
    supabase
      .from("connections")
      .select("id, name")
      .eq("org_id", membership.org_id)
      .order("name", { ascending: true }),
  ]);

  return (
    <DeliveryLogTable
      initialEntries={deliveryLogs ?? []}
      connections={(allConnections ?? []).map((c) => ({ id: c.id, name: c.name })) as Connection[]}
    />
  );
}
