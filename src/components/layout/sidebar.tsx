"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
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
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  appAdminOnly?: boolean;
  children?: { href: string; label: string }[];
}

const navItems: NavItem[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "connections",
    href: "/connections",
    label: "Connections",
    icon: Key,
    adminOnly: true,
  },
  {
    id: "rules",
    href: "/rules",
    label: "Rules",
    icon: ShieldCheck,
  },
  {
    id: "webhooks",
    href: "/webhooks",
    label: "Webhooks",
    icon: Webhook,
    adminOnly: true,
  },
  {
    id: "messaging",
    href: "/messaging",
    label: "Messaging",
    icon: MessageSquare,
    adminOnly: true,
  },
  {
    id: "team",
    href: "/team",
    label: "Team",
    icon: Users,
    adminOnly: true,
    children: [
      { href: "/team", label: "Members" },
      { href: "/organization", label: "Organization" },
    ],
  },
  {
    id: "analytics",
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    children: [
      { href: "/analytics", label: "Overview" },
      { href: "/audit-log", label: "Audit Log" },
    ],
  },
  {
    id: "playground",
    href: "/playground",
    label: "Playground",
    icon: FlaskConical,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { href: "/settings", label: "Preferences" },
      { href: "/settings/oauth", label: "OAuth Apps" },
    ],
  },
  {
    id: "emergency",
    href: "/emergency",
    label: "Emergency",
    icon: AlertTriangle,
    adminOnly: true,
  },
  {
    id: "admin",
    href: "/admin",
    label: "Admin",
    icon: ShieldAlert,
    appAdminOnly: true,
  },
];

export function Sidebar({ pendingCount, userRole, isAppAdmin, showSetup }: SidebarProps) {
  const pathname = usePathname();
  const { activePanel, setActivePanel, setMobileOpen } = useSidebarStore();
  const isAdmin = userRole === "owner" || userRole === "admin";

  const visibleItems = navItems.filter((item) => {
    if (item.appAdminOnly && !isAppAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const handleNavClick = (item: NavItem) => {
    if (item.children && item.children.length > 0) {
      // Toggle sub-panel
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

  return (
    <div className="flex h-full">
      {/* Icon bar — narrow, always visible */}
      <div className="sidebar-icon-bar flex h-full w-16 flex-col items-center py-3">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="mb-3 flex items-center justify-center pt-1"
          onClick={() => { setActivePanel(null); setMobileOpen(false); }}
        >
          <img src="/logo.png" alt="OKRunit" className="size-9" />
        </Link>

        {/* Divider */}
        <div className="mx-auto mb-3 h-px w-7 bg-white/25" />

        {/* Setup item */}
        {showSetup && (
          <Link
            href="/setup"
            onClick={() => { setActivePanel(null); setMobileOpen(false); }}
            className={cn(
              "group relative mb-1 flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-2 text-white/80 transition-colors hover:bg-white/15",
              pathname === "/setup" && "sidebar-nav-active",
            )}
          >
            <Sparkles className="size-5 shrink-0" />
            <span className="text-[9px] font-medium leading-tight">Setup</span>
          </Link>
        )}

        {/* Nav items */}
        <nav className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            const panelOpen = activePanel === item.id;

            return (
              <div key={item.id} className="relative w-full">
                {item.children ? (
                  <button
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      "group flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-md px-1 py-2 text-white/80 transition-colors hover:bg-white/15",
                      (active || panelOpen) && "sidebar-nav-active",
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      "group flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-2 text-white/80 transition-colors hover:bg-white/15",
                      active && "sidebar-nav-active",
                    )}
                  >
                    <div className="relative">
                      <Icon className="size-5 shrink-0" />
                      {item.id === "dashboard" && pendingCount > 0 && (
                        <span className="absolute -right-1.5 -top-1 flex size-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-[var(--sidebar-gradient-from)]">
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Sub-panel — slides out when a nav item with children is active */}
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
