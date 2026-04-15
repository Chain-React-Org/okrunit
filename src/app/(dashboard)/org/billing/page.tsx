import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingManagement } from "@/components/billing/billing-management";

export const metadata = {
  title: "Manage Billing - OKrunit",
  description: "Manage payment methods, billing information, and invoices.",
};

export default async function OrgBillingPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { org, membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/org/overview");

  const admin = createAdminClient();

  const [{ data: subscription }, { data: invoices }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, plan_id, status, billing_cycle, current_period_end")
      .eq("org_id", org.id)
      .single(),
    admin
      .from("invoices")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const hasSubscription = !!subscription?.stripe_subscription_id && subscription.status === "active" && subscription.plan_id !== "free";

  if (!hasSubscription) {
    redirect("/org/subscription");
  }

  return (
    <BillingManagement
      invoices={invoices ?? []}
      isAdmin={membership.role === "owner" || membership.role === "admin"}
    />
  );
}
