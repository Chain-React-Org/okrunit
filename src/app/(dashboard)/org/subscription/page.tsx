import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getCachedSubscriptionData } from "@/lib/cache/queries";
import { getActiveOAuthGrants } from "@/lib/api/oauth-grants";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import type { Subscription } from "@/lib/types/database";

export const metadata = {
  title: "Subscription - OKrunit",
  description: "Manage your subscription and billing.",
};

export default async function OrgBillingPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { org, membership } = ctx;

  const [cached, oauthGrants] = await Promise.all([
    getCachedSubscriptionData(org.id),
    getActiveOAuthGrants(org.id),
  ]);

  const connectionsCount = cached.apiKeyConnectionsCount + oauthGrants.length;

  return (
    <BillingDashboard
      plans={cached.plans}
      subscription={cached.subscription as Subscription | null}
      planOverride={cached.planOverride}
      usage={{
        requests: cached.requestsThisMonth,
        connections: connectionsCount,
        teams: cached.teamsCount,
        teamMembers: cached.membersCount,
      }}
      invoices={cached.invoices}
      isAdmin={membership.role === "owner" || membership.role === "admin"}
      orgId={org.id}
    />
  );
}
