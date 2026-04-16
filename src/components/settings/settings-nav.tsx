"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Calendar, Settings, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  isAdmin: boolean;
  isAppAdmin?: boolean;
  mobile?: boolean;
}

interface SettingsNavItem {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  adminOnly?: boolean;
  comingSoon?: boolean;
}

const navItems: SettingsNavItem[] = [
  { id: "account", label: "Account", href: "/settings/account", icon: User },
  { id: "calendar", label: "Calendar", href: "/settings/calendar", icon: Calendar, comingSoon: true },
  { id: "safety", label: "Safety", href: "/settings/safety", icon: AlertTriangle },
];

export function SettingsNav({ isAdmin, isAppAdmin = false, mobile = false }: SettingsNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (mobile) {
    return (
      <select
        value={visibleItems.find((item) => isActive(item.href))?.href ?? visibleItems[0]?.href}
        onChange={(event) => router.push(event.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      >
        {visibleItems.map((item) => {
          const locked = item.comingSoon && !isAppAdmin;
          return (
            <option key={item.id} value={item.href} disabled={locked}>
              {item.label}{locked ? " (Coming Soon)" : ""}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <nav className="sticky top-0 px-3 pt-5">
      <div className="mb-2 flex items-center gap-2 px-3">
        <Settings className="size-4 text-foreground" />
        <span className="text-sm font-semibold text-foreground">Settings</span>
      </div>
      <div className="space-y-0.5">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          const locked = item.comingSoon && !isAppAdmin;

          if (locked) {
            return (
              <div
                key={item.id}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground/50 cursor-not-allowed"
              >
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-emerald-50 dark:bg-emerald-950/50 font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
