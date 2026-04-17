"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { HeroNav } from "@/components/landing/hero-nav";

interface MarketingSiteHeaderProps {
  user: { email: string; full_name: string | null } | null;
}

const NAV_ITEMS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/integrations", label: "Integrations" },
  { href: "/docs/api", label: "API" },
  { href: "/docs/changelog", label: "Changelog" },
] as const;

export function MarketingSiteHeader({ user }: MarketingSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:gap-6 sm:py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/logo-icon.webp"
            alt="OKrunit"
            width={36}
            height={36}
            className="size-8 object-contain sm:size-9"
            priority
          />
          <span className="text-lg font-bold tracking-tight text-slate-900">
            OKrunit
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden lg:block">
          <HeroNav user={user} />
        </div>

        {/* Mobile: auth + hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
          {user ? (
            <Button size="sm" className="h-8 rounded-lg px-3 text-xs" asChild>
              <Link href="/org/overview">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" className="hidden h-8 rounded-lg border-slate-200 px-2.5 text-xs min-[360px]:flex" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" className="h-8 rounded-lg px-3 text-xs" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="size-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-white p-0">
              <div className="flex flex-col gap-1 px-4 pt-12 pb-6">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-slate-100 px-4 py-4">
                <div className="flex flex-col gap-2">
                  {user ? (
                    <Button className="w-full" asChild>
                      <Link href="/org/overview">Go to Dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button className="w-full" asChild>
                        <Link href="/signup">Sign up</Link>
                      </Button>
                      <Button variant="outline" className="w-full border-slate-200 text-slate-700" asChild>
                        <Link href="/login">Log in</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
