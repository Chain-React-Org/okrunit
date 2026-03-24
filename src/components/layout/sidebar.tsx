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
  MoreHorizontal,
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
  { id: "home", href: "/dashboard", label: "Home", icon: Home },
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
  // Overflow items — shown in "More" menu
  { id: "playground", href: "/playground", label: "Playground", icon: FlaskConical, overflow: true },
  {
    id: "settings", href: "/settings", label: "Settings", icon: Settings, overflow: true,
    children: [{ href: "/settings", label: "Preferences" }, { href: "/settings/oauth", label: "OAuth Apps" }],
  },
  { id: "emergency", href: "/emergency", label: "Emergency", icon: AlertTriangle, adminOnly: true, overflow: true },
  { id: "admin", href: "/admin", label: "Admin", icon: ShieldAlert, appAdminOnly: true, overflow: true },
];

// Max primary items before "More" button (excluding overflow-flagged items)
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

  // Split into primary and overflow
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

    const classes = cn(
      "group flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-white/75 transition-colors hover:bg-white/15",
      (active || panelOpen) && "sidebar-nav-active",
    );

    const content = (
      <>
        <div className="relative flex size-8 items-center justify-center rounded-md group-hover:bg-white/10 transition-colors">
          <Icon className="size-5 shrink-0" />
          {item.id === "requests" && pendingCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-[var(--sidebar-gradient-to)]">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium leading-tight">{item.label}</span>
      </>
    );

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
      <div className="sidebar-icon-bar flex h-full w-20 flex-col items-center py-4">
        {/* Logo — icon only, centered in sidebar */}
        <Link
          href="/dashboard"
          className="mb-1 flex size-12 items-center justify-center rounded-xl"
          onClick={() => { setActivePanel(null); setMobileOpen(false); }}
        >
          <img src="/logo-icon.png" alt="OKRunit" className="size-10 object-contain drop-shadow-md" />
        </Link>

        {/* Divider */}
        <div className="mx-auto mb-3 h-px w-8 bg-white/25" />

        {/* Setup */}
        {showSetup && (
          <Link
            href="/setup"
            onClick={() => { setActivePanel(null); setMobileOpen(false); }}
            className={cn(
              "group mb-1 flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-white/75 transition-colors hover:bg-white/15",
              pathname === "/setup" && "sidebar-nav-active",
            )}
          >
            <div className="flex size-8 items-center justify-center rounded-md">
              <Sparkles className="size-5 shrink-0" />
            </div>
            <span className="text-[10px] font-medium leading-tight">Setup</span>
          </Link>
        )}

        {/* Primary nav items */}
        <nav className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-2">
          {primaryItems.map(renderNavItem)}
        </nav>

        {/* More button — overflow items */}
        {overflowItems.length > 0 && (
          <div className="relative w-full px-2 pb-1">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                "group flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-white/75 transition-colors hover:bg-white/15",
                (moreOpen || anyOverflowActive) && "sidebar-nav-active",
              )}
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <MoreHorizontal className="size-5" />
              </div>
              <span className="text-[10px] font-medium leading-tight">More</span>
            </button>

            {/* Overflow popover */}
            {moreOpen && (
              <div className="absolute bottom-0 left-full z-50 ml-2 w-48 rounded-lg border border-border bg-card py-2 shadow-lg">
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">More</span>
                  <button onClick={() => setMoreOpen(false)} className="text-muted-foreground hover:text-foreground">
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
