"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Key,
  MessageSquare,
  Users,
  FileText,
  Webhook,
  Settings,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  BarChart3,
  FlaskConical,
  Building2,
  ShieldAlert,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/layout/org-switcher";
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
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  appAdminOnly?: boolean;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/connections", label: "Connections", icon: Key, adminOnly: true },
      { href: "/rules", label: "Rules", icon: ShieldCheck },
      { href: "/webhooks", label: "Webhooks", icon: Webhook, adminOnly: true },
      { href: "/playground", label: "Playground", icon: FlaskConical },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/team", label: "Team", icon: Users, adminOnly: true },
      { href: "/messaging", label: "Messaging", icon: MessageSquare, adminOnly: true },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/audit-log", label: "Audit Log", icon: FileText },
      { href: "/organization", label: "Settings", icon: Building2, adminOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Preferences", icon: Settings },
      { href: "/emergency", label: "Emergency", icon: AlertTriangle, adminOnly: true },
      { href: "/admin", label: "Admin", icon: ShieldAlert, appAdminOnly: true },
    ],
  },
];

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
}

export function Sidebar({ user, currentOrgId, userOrgs, pendingCount, userRole, isAppAdmin, showSetup }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle, setMobileOpen } = useSidebarStore();
  const isAdmin = userRole === "owner" || userRole === "admin";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    setMobileOpen(false);
  };

  return (
    <aside
      className={cn(
        "sidebar-transition flex h-full flex-col bg-[var(--sidebar)] overflow-hidden",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Logo + Org */}
      <div className={cn("flex flex-col gap-3 border-b border-[var(--sidebar-border)] px-3 py-4", collapsed && "items-center px-2")}>
        <Link href="/dashboard" className={cn("flex", collapsed ? "justify-center" : "px-1")} onClick={handleNavClick}>
          {collapsed ? (
            <img src="/logo.png" alt="OKRunit" className="size-7" />
          ) : (
            <img src="/logo_text_white.png" alt="OKRunit" className="h-6 w-auto" />
          )}
        </Link>
        {!collapsed && <OrgSwitcher currentOrgId={currentOrgId} orgs={userOrgs} collapsed={false} />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {showSetup && (
          <div className="mb-3">
            <Link
              href="/setup"
              onClick={handleNavClick}
              title={collapsed ? "Setup" : undefined}
              className={cn(
                "sidebar-nav-item flex items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                pathname === "/setup"
                  ? "sidebar-nav-active"
                  : "border-l-3 border-l-transparent text-[var(--sidebar-primary)] hover:bg-[var(--sidebar-accent)]",
                collapsed && "justify-center px-0",
              )}
            >
              <Sparkles className="size-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">Setup</span>
                  <Badge className="h-5 bg-[var(--sidebar-primary)]/20 px-1.5 text-[10px] font-medium text-[var(--sidebar-primary)] hover:bg-[var(--sidebar-primary)]/20">
                    New
                  </Badge>
                </>
              )}
            </Link>
          </div>
        )}

        {navSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter((item) => {
            if (item.appAdminOnly && !isAppAdmin) return false;
            if (item.adminOnly && !isAdmin) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={sectionIndex} className={sectionIndex > 0 ? "mt-5 pt-4 border-t border-[var(--sidebar-border)]" : ""}>
              {section.label && !collapsed && (
                <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-muted)]">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "sidebar-nav-item flex items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                        isActive
                          ? "sidebar-nav-active"
                          : "border-l-3 border-l-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.href === "/dashboard" && pendingCount > 0 && (
                            <Badge className="h-5 min-w-5 bg-[var(--sidebar-primary)] px-1.5 text-[10px] font-semibold text-white hover:bg-[var(--sidebar-primary)]">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </Badge>
                          )}
                        </>
                      )}
                      {collapsed && item.href === "/dashboard" && pendingCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--sidebar-primary)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("hidden md:flex border-t border-[var(--sidebar-border)] px-2 py-2", collapsed ? "justify-center" : "justify-end")}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      {/* User section */}
      <div className={cn("border-t border-[var(--sidebar-border)] p-3", collapsed && "flex justify-center p-2")}>
        {collapsed ? (
          <button
            onClick={handleSignOut}
            title={`${user.full_name ?? user.email} — Sign out`}
            className="cursor-pointer"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] text-xs font-medium">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
            <Avatar className="size-8">
              <AvatarFallback className="bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] text-xs font-medium">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-[var(--sidebar-accent-foreground)]">
                {user.full_name ?? user.email}
              </p>
              {user.full_name && (
                <p className="truncate text-xs text-[var(--sidebar-muted)]">
                  {user.email}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSignOut}
              title="Sign out"
              className="text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
