"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bug,
  Building2,
  Globe,
  CreditCard,
  Users,
  Webhook,
  KeyRound,
  ShieldAlert,
  Mail,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof BarChart3;
  badge?: number | string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", href: "/admin/overview", icon: BarChart3 },
  { id: "organizations", label: "Organizations", href: "/admin/organizations", icon: Building2 },
  { id: "users", label: "Users", href: "/admin/users", icon: Users },
  { id: "webhook-tester", label: "Webhook Tester", href: "/admin/webhook-tester", icon: Webhook },
  { id: "oauth", label: "OAuth Apps", href: "/admin/oauth", icon: KeyRound },
  { id: "email-previews", label: "Email Previews", href: "/admin/email-previews", icon: Mail },
  { id: "plan-overrides", label: "Plan Overrides", href: "/admin/plan-overrides", icon: CreditCard },
  { id: "errors", label: "Error Monitor", href: "/admin/errors", icon: Bug },
  { id: "traffic", label: "Traffic", href: "/admin/traffic", icon: Globe },
];

interface AdminNavProps {
  orgCounts?: Record<string, number>;
  userCount?: number;
  mobile?: boolean;
}

export function AdminNav({ orgCounts, userCount, mobile }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const items = NAV_ITEMS.map((item) => ({
    ...item,
    badge:
      item.id === "organizations" ? orgCounts?.organizations :
      item.id === "users" ? userCount :
      undefined,
  }));

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  if (mobile) {
    return (
      <select
        value={items.find((i) => isActive(i.href))?.href ?? "/admin/overview"}
        onChange={(e) => router.push(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      >
        {items.map((item) => (
          <option key={item.id} value={item.href}>
            {item.label}{item.badge !== undefined ? ` (${item.badge})` : ""}
          </option>
        ))}
      </select>
    );
  }

  return (
    <nav className="flex-1 flex flex-col px-3" aria-label="Admin sections">
      <div className="flex items-center gap-2 px-3 mb-2">
        <ShieldAlert className="size-4 text-foreground" />
        <span className="text-sm font-semibold text-foreground">Admin</span>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-emerald-50 dark:bg-emerald-950/50 font-medium text-emerald-700 dark:text-emerald-400"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  active
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
