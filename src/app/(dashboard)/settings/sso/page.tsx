import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { canUseFeature } from "@/lib/billing/enforce";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SSOConfigForm } from "@/components/settings/sso-config-form";
import { Shield } from "lucide-react";

export const metadata = {
  title: "SSO Settings - OKRunit",
  description: "Configure SAML Single Sign-On for your organization.",
};

export default async function SSOSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const { membership, org } = ctx;
  const isAdmin = membership.role === "owner" || membership.role === "admin";

  if (!isAdmin) {
    redirect("/settings/account");
  }

  const ssoFeature = await canUseFeature(org.id, "sso_saml");

  return (
    <PageContainer>
      <PageHeader
        title="SSO"
        description="Configure SAML Single Sign-On for your organization."
      />

      {ssoFeature.allowed ? (
        <SSOConfigForm orgId={org.id} />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted/50">
            <Shield className="size-7 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">SSO is a Business Plan Feature</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            SAML Single Sign-On is available on the Business and Enterprise plans.
            Upgrade to enable SSO for your organization.
          </p>
          <Link
            href="/org/subscription"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Upgrade Plan
          </Link>
        </div>
      )}
    </PageContainer>
  );
}
