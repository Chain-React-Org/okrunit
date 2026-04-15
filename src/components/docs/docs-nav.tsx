"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavSection {
  title: string;
  items: { href: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/onboarding", label: "Onboarding Guide" },
      { href: "/docs/mobile-app", label: "Mobile App" },
    ],
  },
  {
    title: "Core Features",
    items: [
      { href: "/docs/approvals", label: "Approval Workflow" },
      { href: "/docs/rules", label: "Rules & Routing" },
      { href: "/docs/escalation", label: "Escalation" },
      { href: "/docs/multi-step", label: "Multi-Step Approvals" },
      { href: "/docs/bulk-operations", label: "Bulk Operations" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/docs/sla", label: "SLA & Response Targets" },
      { href: "/docs/custom-roles", label: "Custom Roles" },
      { href: "/docs/notifications", label: "Notifications & Quiet Hours" },
      { href: "/docs/sso", label: "SSO / SAML" },
      { href: "/docs/passkeys", label: "Passkeys & Security Keys" },
    ],
  },
  {
    title: "Integrations & API",
    items: [
      { href: "/docs/integrations", label: "Integrations" },
      { href: "/docs/api", label: "API Reference" },
      { href: "/docs/webhooks", label: "Webhooks & Callbacks" },
      { href: "/docs/shortcuts", label: "Keyboard Shortcuts" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/docs/billing", label: "Plans & Billing" },
      { href: "/docs/changelog", label: "Changelog" },
    ],
  },
];

// Flat list for mobile
const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

function isActive(pathname: string, href: string) {
  if (href === "/docs") return pathname === "/docs";
  return pathname.startsWith(href);
}

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-24 space-y-5">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-emerald-50 text-emerald-700 border-l-2 border-emerald-600"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DocsMobileNav() {
  const pathname = usePathname();

  return (
    <div className="mb-8 flex gap-2 overflow-x-auto border-b border-zinc-200 pb-4 lg:hidden">
      {ALL_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-emerald-50 text-emerald-700"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
