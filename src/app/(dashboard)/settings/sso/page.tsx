import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { getOrgPlan } from "@/lib/billing/enforce";
import { hasFeature } from "@/lib/billing/plans";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SSOConfigForm } from "@/components/settings/sso-config-form";

export const metadata = {
  title: "SSO Configuration - OKRunit",
  description: "Configure SAML Single Sign-On for your organization.",
};

export default async function SSOSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const isAdmin = ctx.membership.role === "owner" || ctx.membership.role === "admin";
  if (!isAdmin) redirect("/dashboard");

  const plan = await getOrgPlan(ctx.org.id);
  const hasSso = hasFeature(plan, "sso_saml");

  return (
    <PageContainer>
      <PageHeader
        title="Single Sign-On (SSO)"
        description="Configure SAML-based Single Sign-On so your team can log in with your identity provider."
      />

      {!hasSso ? (
        <div className="rounded-xl border border-[var(--border)] bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted/50">
            <svg className="size-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">SSO is a Business Plan Feature</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            SAML Single Sign-On is available on the Business and Enterprise plans.
            Upgrade to enable SSO for your organization.
          </p>
          <a
            href="/billing"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Upgrade Plan
          </a>
        </div>
      ) : (
        <SSOConfigForm orgId={ctx.org.id} />
      )}
    </PageContainer>
  );
}
