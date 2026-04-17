import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "@/components/marketing/newsletter-form";

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs/integrations", label: "Integrations" },
      { href: "/docs/api", label: "API" },
      { href: "/pricing", label: "Pricing" },
      { href: "/docs/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/contact", label: "Contact" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/security", label: "Security" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-green-200/80 bg-[#e8f5e9]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo-icon.webp"
                alt="OKrunit"
                width={32}
                height={32}
                className="size-8 object-contain"
              />
              <div>
                <p className="text-base font-semibold text-slate-900">OKrunit</p>
                <p className="text-sm text-slate-600">
                  Human approval for automations and agents
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-500">
              Route high-risk actions through one approval layer before they
              execute, with clear routing, reviewer context, and audit visibility.
            </p>
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {group.title}
                </p>
                <div className="space-y-2">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block text-slate-600 transition-colors hover:text-slate-950"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-green-200/80 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 OKrunit. United States.</p>
          <p>Built for teams shipping automations with human oversight.</p>
        </div>
      </div>
    </footer>
  );
}
