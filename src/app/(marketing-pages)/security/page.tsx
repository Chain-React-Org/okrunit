import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  Key,
  Lock,
  ScrollText,
  Shield,
  Webhook,
} from "lucide-react";
import {
  MarketingPageSection,
  MarketingPageShell,
} from "@/components/marketing/marketing-page-shell";

export const metadata: Metadata = {
  title: "Security",
  description:
    "A product-level overview of the controls OKrunit uses to protect approvals, callbacks, and operational workflows.",
};

export default function SecurityPage() {
  return (
    <MarketingPageShell
      eyebrow="Trust"
      title="Security overview"
      intro="OKrunit is built to help teams add security and operational control to automated actions. This page summarizes the product controls customers commonly evaluate when reviewing the platform."
    >
      <MarketingPageSection
        title="Authentication and access"
        intro="The platform supports multiple access models depending on how a workflow integrates."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Key,
              title: "API keys",
              body: "Server-to-server workflows can authenticate with connection-specific API keys for approval creation and management.",
            },
            {
              icon: Lock,
              title: "OAuth 2.0",
              body: "User-facing integrations can connect through OAuth with PKCE instead of sharing raw credentials directly with automation platforms.",
            },
            {
              icon: Shield,
              title: "SSO / SAML",
              body: "Organizations can centralize authentication through SSO for tighter identity and access management.",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 mb-3">
                  <Icon className="size-4.5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {card.body}
                </p>
              </div>
            );
          })}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        title="Controls around sensitive actions"
        intro="OKrunit is not just an inbox for approvals. It is a control layer around actions that should not execute automatically."
      >
        <div className="grid gap-3">
          {[
            "Approval requests can be routed to specific people or teams based on source, priority, and request type.",
            "Teams can require human review before a workflow continues, including multi-step and designated approval flows.",
            "The product records request and decision history so operators can review exactly what was approved, rejected, or changed.",
            "Operational controls such as connection management, key rotation, and emergency-stop style workflow controls help teams reduce blast radius when something goes wrong.",
          ].map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="size-3 text-emerald-600" />
              </span>
              <span className="text-sm text-slate-900">{item}</span>
            </div>
          ))}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        title="Delivery integrity and traceability"
        intro="Security depends on being able to trust both the outcome and the path it took."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              icon: Webhook,
              title: "Webhook callbacks",
              body: "Approval results can be delivered back to your systems through signed webhook callbacks so downstream workflows can verify origin before acting on the decision.",
            },
            {
              icon: ScrollText,
              title: "Audit history",
              body: "Audit logs capture request activity, flow changes, and route updates to support investigation, compliance review, and debugging.",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 mb-3">
                  <Icon className="size-4.5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {card.body}
                </p>
              </div>
            );
          })}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        title="Learn more"
        intro="The most implementation-specific security details live in the product documentation."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { href: "/docs/api", label: "API authentication and request model", icon: Code2 },
            { href: "/docs/webhooks", label: "Webhooks and callback verification", icon: Webhook },
            { href: "/docs/sso", label: "SSO and SAML configuration", icon: Shield },
          ].map((link) => {
            const LinkIcon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col items-center gap-3 rounded-xl border border-slate-200/60 bg-white px-5 py-6 text-center shadow-sm transition-all hover:shadow-md hover:border-emerald-300"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 transition-colors group-hover:bg-emerald-100">
                  <LinkIcon className="size-5 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-slate-900">{link.label}</span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-emerald-700">
                  Read docs
                  <ArrowRight className="size-3" />
                </span>
              </Link>
            );
          })}
        </div>
      </MarketingPageSection>
    </MarketingPageShell>
  );
}
