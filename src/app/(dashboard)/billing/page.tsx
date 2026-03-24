import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import type { Plan, Subscription } from "@/lib/types/database";

export const metadata = {
  title: "Billing - OKRunit",
  description: "Manage your subscription and billing.",
};

export default async function BillingPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { org, membership } = ctx;

  const admin = createAdminClient();

  const [
    { data: plans },
    { data: subscription },
    { count: requestsThisMonth },
    { count: connectionsCount },
    { count: membersCount },
    { data: invoices },
  ] = await Promise.all([
    admin.from("plans").select("*").eq("is_active", true).order("sort_order").returns<Plan[]>(),
    admin.from("subscriptions").select("*").eq("org_id", org.id).single(),
    admin.from("approval_requests").select("*", { count: "exact", head: true }).eq("org_id", org.id).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    admin.from("connections").select("*", { count: "exact", head: true }).eq("org_id", org.id).eq("is_active", true),
    admin.from("org_memberships").select("*", { count: "exact", head: true }).eq("org_id", org.id),
    admin.from("invoices").select("*").eq("org_id", org.id).order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Billing"
        description="Manage your subscription, view usage, and download invoices."
      />
      <BillingDashboard
        plans={plans ?? []}
        subscription={subscription as Subscription | null}
        usage={{
          requests: requestsThisMonth ?? 0,
          connections: connectionsCount ?? 0,
          teamMembers: membersCount ?? 0,
        }}
        invoices={invoices ?? []}
        isAdmin={membership.role === "owner" || membership.role === "admin"}
        orgId={org.id}
      />
    </PageContainer>
  );
}
