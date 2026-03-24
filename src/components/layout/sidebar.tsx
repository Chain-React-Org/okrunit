"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Key,
  MessageSquare,
  Users,
  Webhook,
  Settings,
  AlertTriangle,
  BarChart3,
  FlaskConical,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  MoreVertical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  currentOrgId: string;
  userOrgs: { id: string; org_id: string; org_name: string; role: string; is_default: boolean }[];
  pendingCount: number;
  userRole: string;
  isAppAdmin?: boolean;
  showSetup?: boolean;
}

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
  appAdminOnly?: boolean;
  overflow?: boolean;
  children?: { href: string; label: string }[];
}

const navItems: NavItem[] = [
  { id: "home", href: "/dashboard", label: "Org", icon: Home },
  { id: "requests", href: "/requests", label: "Requests", icon: ClipboardList },
  { id: "connections", href: "/connections", label: "Connections", icon: Key, adminOnly: true },
  { id: "rules", href: "/rules", label: "Rules", icon: ShieldCheck },
  { id: "webhooks", href: "/webhooks", label: "Webhooks", icon: Webhook, adminOnly: true },
  { id: "messaging", href: "/messaging", label: "Messaging", icon: MessageSquare, adminOnly: true },
  {
    id: "team", href: "/team", label: "Team", icon: Users, adminOnly: true,
    children: [{ href: "/team", label: "Members" }, { href: "/organization", label: "Organization" }],
  },
  {
    id: "analytics", href: "/analytics", label: "Analytics", icon: BarChart3,
    children: [{ href: "/analytics", label: "Overview" }, { href: "/audit-log", label: "Audit Log" }],
  },
  { id: "playground", href: "/playground", label: "Playground", icon: FlaskConical, overflow: true },
  {
    id: "settings", href: "/settings", label: "Settings", icon: Settings, overflow: true,
    children: [{ href: "/settings", label: "Preferences" }, { href: "/settings/oauth", label: "OAuth Apps" }],
  },
  { id: "emergency", href: "/emergency", label: "Emergency", icon: AlertTriangle, adminOnly: true, overflow: true },
  { id: "admin", href: "/admin", label: "Admin", icon: ShieldAlert, appAdminOnly: true, overflow: true },
];

const MAX_PRIMARY = 8;

export function Sidebar({ pendingCount, userRole, isAppAdmin, showSetup }: SidebarProps) {
  const pathname = usePathname();
  const { activePanel, setActivePanel, setMobileOpen } = useSidebarStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = userRole === "owner" || userRole === "admin";

  const visibleItems = navItems.filter((item) => {
    if (item.appAdminOnly && !isAppAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const primaryItems = visibleItems.filter((i) => !i.overflow).slice(0, MAX_PRIMARY);
  const overflowItems = [
    ...visibleItems.filter((i) => !i.overflow).slice(MAX_PRIMARY),
    ...visibleItems.filter((i) => i.overflow),
  ];

  const handleNavClick = (item: NavItem) => {
    setMoreOpen(false);
    if (item.children && item.children.length > 0) {
      setActivePanel(activePanel === item.id ? null : item.id);
    } else {
      setActivePanel(null);
      setMobileOpen(false);
    }
  };

  const isItemActive = (item: NavItem) => {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
    if (item.children) {
      return item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
    }
    return false;
  };

  const activePanelItem = visibleItems.find((i) => i.id === activePanel);
  const anyOverflowActive = overflowItems.some((i) => isItemActive(i));

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isItemActive(item);
    const panelOpen = activePanel === item.id;
    const isActive = active || panelOpen;

    const content = (
      <>
        <div className={cn(
          "relative flex size-9 items-center justify-center rounded-lg transition-colors",
          isActive ? "bg-white/20" : "group-hover:bg-white/15",
        )}>
          <Icon className="size-[22px] shrink-0" />
          {item.id === "requests" && pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex size-[18px] items-center justify-center rounded-full bg-white text-[9px] font-bold text-[var(--sidebar-gradient-to)]">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </div>
        <span className={cn(
          "text-[11px] leading-tight",
          isActive ? "font-semibold text-white" : "font-medium",
        )}>{item.label}</span>
      </>
    );

    const classes = "group flex w-full cursor-pointer flex-col items-center gap-1.5 py-3 text-white/80 transition-colors";

    if (item.children) {
      return (
        <button key={item.id} onClick={() => handleNavClick(item)} className={classes}>
          {content}
        </button>
      );
    }

    return (
      <Link key={item.id} href={item.href} onClick={() => handleNavClick(item)} className={classes}>
        {content}
      </Link>
    );
  };

  return (
    <div className="flex h-full">
      {/* Icon bar */}
      <div className="sidebar-icon-bar flex h-full w-20 flex-col items-center">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="mb-2 flex w-full items-center justify-center px-2 py-1"
          onClick={() => { setActivePanel(null); setMobileOpen(false); }}
        >
          <img src="/logo-icon.png" alt="OKRunit" className="size-10 object-contain drop-shadow-md" />
        </Link>

        {/* First item (Org/Home) — above divider like Make.com */}
        {primaryItems.length > 0 && renderNavItem(primaryItems[0])}

        {/* Divider — between first item and rest */}
        <div className="mx-auto my-2 h-px w-7 bg-white/25" />

        {/* Setup */}
        {showSetup && (
          <Link
            href="/setup"
            onClick={() => { setActivePanel(null); setMobileOpen(false); }}
            className="group flex w-full cursor-pointer flex-col items-center gap-1.5 py-3 text-white/80 transition-colors"
          >
            <div className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              pathname === "/setup" ? "bg-white/20" : "group-hover:bg-white/15",
            )}>
              <Sparkles className="size-[22px] shrink-0" />
            </div>
            <span className={cn(
              "text-[11px] leading-tight",
              pathname === "/setup" ? "font-semibold text-white" : "font-medium",
            )}>Setup</span>
          </Link>
        )}

        {/* Remaining primary nav items */}
        <nav className="flex w-full flex-1 flex-col items-center overflow-y-auto">
          {primaryItems.slice(1).map((item) => renderNavItem(item))}
        </nav>

        {/* More button */}
        {overflowItems.length > 0 && (
          <div className="relative w-full pb-3">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="group flex w-full cursor-pointer flex-col items-center gap-1.5 py-3 text-white/80 transition-colors"
            >
              <div className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors",
                (moreOpen || anyOverflowActive) ? "bg-white/20" : "group-hover:bg-white/15",
              )}>
                <MoreVertical className="size-[22px]" />
              </div>
              <span className={cn(
                "text-[11px] leading-tight",
                (moreOpen || anyOverflowActive) ? "font-semibold text-white" : "font-medium",
              )}>More</span>
            </button>

            {moreOpen && (
              <div className="absolute bottom-0 left-full z-50 ml-2 w-48 rounded-lg border border-border bg-card py-2 shadow-lg">
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">More</span>
                  <button onClick={() => setMoreOpen(false)} className="cursor-pointer text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => handleNavClick(item)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sub-panel */}
      {activePanelItem?.children && (
        <div className="sidebar-subpanel flex h-full w-44 flex-col py-4">
          <h3 className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {activePanelItem.label}
          </h3>
          <nav className="flex flex-col gap-0.5 px-2">
            {activePanelItem.children.map((child) => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    childActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
