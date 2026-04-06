"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Mail,
  UsersRound,
  Settings,
  CreditCard,
  Receipt,
  Building2,
  Shield,
  Wallet,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  badge?: number | string;
}

interface NavSection {
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

interface V2OrgNavProps {
  isAdmin: boolean;
  pendingInviteCount: number;
  planName?: string;
  mobile?: boolean;
}

export function V2OrgNav({ isAdmin, pendingInviteCount, planName, mobile }: V2OrgNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const sections: NavSection[] = [
    {
      label: "Organization",
      icon: Building2,
      items: [
        { id: "overview", label: "Overview", href: "/org/overview", icon: LayoutDashboard },
        { id: "organizations", label: "Organizations", href: "/org/organizations", icon: Building2 },
        { id: "teams", label: "Teams", href: "/org/teams", icon: UsersRound, adminOnly: true },
        { id: "members", label: "Members", href: "/org/members", icon: Users, adminOnly: true },
        { id: "roles", label: "Roles", href: "/org/roles", icon: Shield, adminOnly: true },
        {
          id: "invites",
          label: "Invites",
          href: "/org/invites",
          icon: Mail,
          adminOnly: true,
          badge: pendingInviteCount > 0 ? pendingInviteCount : undefined,
        },
      ],
    },
    {
      label: "My Plan",
      icon: Wallet,
      items: [
        {
          id: "subscription",
          label: "Subscription",
          href: "/org/subscription",
          icon: CreditCard,
          adminOnly: true,
          badge: planName,
        },
        { id: "payments", label: "Payments", href: "/org/payments", icon: Receipt, adminOnly: true },
      ],
    },
  ];

  // Bottom items outside sections
  const ssoItem: NavItem = {
    id: "sso",
    label: "SSO",
    href: "/org/sso",
    icon: Shield,
    adminOnly: true,
  };

  const settingsItem: NavItem = {
    id: "settings",
    label: "Settings",
    href: "/org/settings",
    icon: Settings,
    adminOnly: true,
  };

  // Flatten for mobile + filtering
  const allItems = [
    ...sections.flatMap((s) => s.items),
    ssoItem,
    settingsItem,
  ].filter((item) => !item.adminOnly || isAdmin);

  // Mobile: dropdown select
  if (mobile) {
    return (
      <select
        value={allItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.href ?? "/org/overview"}
        onChange={(e) => router.push(e.target.value)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      >
        {sections.map((section) => (
          <optgroup key={section.label} label={section.label}>
            {section.items
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <option key={item.id} value={item.href}>
                  {item.label}
                </option>
              ))}
          </optgroup>
        ))}
        {(!settingsItem.adminOnly || isAdmin) && (
          <option value={settingsItem.href}>{settingsItem.label}</option>
        )}
        {(!ssoItem.adminOnly || isAdmin) && (
          <option value={ssoItem.href}>{ssoItem.label}</option>
        )}
      </select>
    );
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Desktop: vertical sidebar nav with sections
  return (
    <nav className="flex-1 flex flex-col px-3" aria-label="Org sections">
      {sections.map((section, idx) => {
        const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);
        if (visibleItems.length === 0) return null;

        const SectionIcon = section.icon;
        return (
          <div key={section.label} className={cn(idx > 0 && "mt-4")}>
            {/* Section heading */}
            <div className="flex items-center gap-2 px-3 mb-2">
              <SectionIcon className="size-4 text-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {section.label}
              </span>
            </div>

            {/* Page links */}
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
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

            {/* Divider after section */}
            <div className="mt-3 border-b border-border/40 mx-3" />
          </div>
        );
      })}

      {/* SSO & Settings — pinned at bottom */}
      {((!ssoItem.adminOnly || isAdmin) || (!settingsItem.adminOnly || isAdmin)) && (
        <div className="mt-4">
          <div className="flex items-center gap-2 px-3 mb-2">
            <Settings className="size-4 text-foreground" />
            <span className="text-sm font-semibold text-foreground">Settings</span>
          </div>
          <div className="space-y-0.5">
            {(!settingsItem.adminOnly || isAdmin) && (
              <Link
                href={settingsItem.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                  isActive(settingsItem.href)
                    ? "bg-emerald-50 dark:bg-emerald-950/50 font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {settingsItem.label}
              </Link>
            )}
            {(!ssoItem.adminOnly || isAdmin) && (
              <Link
                href={ssoItem.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                  isActive(ssoItem.href)
                    ? "bg-emerald-50 dark:bg-emerald-950/50 font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {ssoItem.label}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
