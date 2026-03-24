import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s | OKRunit Docs",
  },
  description:
    "OKRunit documentation — API reference, integration guides, webhooks, and getting started instructions.",
};

const NAV_ITEMS = [
  { href: "/docs", label: "Getting Started" },
  { href: "/docs/api", label: "API Reference" },
  { href: "/docs/integrations", label: "Integrations" },
  { href: "/docs/webhooks", label: "Webhooks & Callbacks" },
  { href: "/docs/billing", label: "Plans & Billing" },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-zinc-900 hover:text-zinc-700 transition-colors"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-emerald-600"
            >
              <rect width="24" height="24" rx="6" fill="currentColor" />
              <path
                d="M7 12.5l3 3 7-7"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            OKRunit
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium text-zinc-600">Docs</span>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="mb-8 flex gap-2 overflow-x-auto border-b border-zinc-200 pb-4 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Content */}
        <main className="min-w-0 max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
