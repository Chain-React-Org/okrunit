import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Code2,
  CreditCard,
  Headphones,
  Mail,
  Shield,
  Webhook,
  Puzzle,
} from "lucide-react";
import {
  MarketingPageSection,
  MarketingPageShell,
} from "@/components/marketing/marketing-page-shell";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to contact OKrunit for support, sales, and product questions.",
};

export default function ContactPage() {
  return (
    <MarketingPageShell
      eyebrow="Company"
      title="Contact OKrunit"
      intro="Use the channel that matches what you need. Product questions, implementation help, and account support should go to support. Enterprise pricing and rollout discussions should go to sales."
    >
      <MarketingPageSection
        title="Send us a message"
        intro="Fill out the form below and we'll get back to you as soon as we can."
      >
        <ContactForm />
      </MarketingPageSection>

      <MarketingPageSection
        title="Or reach us directly"
        intro="Prefer email? Use the mailbox that matches your question."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              icon: Headphones,
              label: "Support",
              email: "support@okrunit.com",
              body: "Product questions, account help, implementation guidance, and troubleshooting.",
            },
            {
              icon: Mail,
              label: "Sales",
              email: "sales@okrunit.com",
              body: "Enterprise pricing, rollout planning, procurement, and custom deployment discussions.",
            },
            {
              icon: Shield,
              label: "Privacy & Trust",
              email: "privacy@okrunit.com",
              body: "Questions about privacy, security posture, or trust-related product controls.",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.label}
                href={`mailto:${card.email}`}
                className="group rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 mb-3">
                  <Icon className="size-4.5 text-emerald-600" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {card.label}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  {card.email}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  {card.body}
                </p>
              </a>
            );
          })}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        title="Self-serve resources"
        intro="If you just need implementation details, the docs usually answer it faster than a support thread."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Technical setup
            </h3>
            <div className="mt-3 space-y-2">
              {[
                { href: "/docs", label: "Getting started", icon: BookOpen },
                { href: "/docs/api", label: "API reference", icon: Code2 },
                { href: "/docs/webhooks", label: "Webhooks and callbacks", icon: Webhook },
              ].map((link) => {
                const LinkIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <LinkIcon className="size-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Product and rollout
            </h3>
            <div className="mt-3 space-y-2">
              {[
                { href: "/docs/integrations", label: "Supported integrations", icon: Puzzle },
                { href: "/docs/billing", label: "Plans and billing", icon: CreditCard },
                { href: "/security", label: "Security overview", icon: Shield },
              ].map((link) => {
                const LinkIcon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <LinkIcon className="size-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </MarketingPageSection>
    </MarketingPageShell>
  );
}
