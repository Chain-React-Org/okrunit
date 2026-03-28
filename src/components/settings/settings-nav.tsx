"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Settings, Shield, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  isAdmin: boolean;
  mobile?: boolean;
}

interface SettingsNavItem {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  adminOnly?: boolean;
}

const navItems: SettingsNavItem[] = [
  { id: "account", label: "Account", href: "/settings/account", icon: User },
  { id: "safety", label: "Safety", href: "/settings/safety", icon: AlertTriangle },
  { id: "sso", label: "SSO", href: "/settings/sso", icon: Shield, adminOnly: true },
];

export function SettingsNav({ isAdmin, mobile = false }: SettingsNavProps) {
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
        {visibleItems.map((item) => (
          <option key={item.id} value={item.href}>
            {item.label}
          </option>
        ))}
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
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
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
