import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { DocsSidebar, DocsMobileNav } from "@/components/docs/docs-nav";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s | OKrunit Docs",
  },
  description:
    "OKrunit documentation — API reference, integration guides, webhooks, and getting started instructions.",
};

async function DocsAuthNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <Link
        href="/dashboard"
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
      >
        Go to Dashboard
      </Link>
    );
  }

  return (
    <>
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
    </>
  );
}

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
            <Image
              src="/logo-icon.png"
              alt="OKrunit"
              width={24}
              height={24}
              className="size-6 object-contain"
            />
            OKrunit
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium text-zinc-600">Docs</span>
          <div className="ml-auto flex items-center gap-4">
            <Suspense fallback={
              <Link
                href="/login"
                className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Sign in
              </Link>
            }>
              <DocsAuthNav />
            </Suspense>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <DocsSidebar />
        </aside>

        {/* Mobile nav */}
        <DocsMobileNav />

        {/* Content */}
        <main className="min-w-0 max-w-3xl">{children}</main>
      </div>

      <SiteFooter />
    </div>
  );
}
