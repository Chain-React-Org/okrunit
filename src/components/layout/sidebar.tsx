"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Settings,
  FlaskConical,
  ShieldAlert,
  MoreVertical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import type { ApprovalRequest } from "@/lib/types/database";

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
  { id: "home", href: "/org/overview", label: "Org", icon: Home },
  { id: "requests", href: "/requests", label: "Requests", icon: ClipboardList },
  { id: "playground", href: "/playground/request-builder", label: "Playground", icon: FlaskConical, overflow: true },
  { id: "settings", href: "/settings/account", label: "Settings", icon: Settings, overflow: true },
  { id: "admin", href: "/admin", label: "Admin", icon: ShieldAlert, appAdminOnly: true, overflow: true },
];

export const Sidebar = memo(function Sidebar({ pendingCount: initialPendingCount, userRole, isAppAdmin, currentOrgId }: SidebarProps) {
  const pathname = usePathname();
  const { activePanel, setActivePanel, setMobileOpen } = useSidebarStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [maxVisible, setMaxVisible] = useState(20);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const isAdmin = userRole === "owner" || userRole === "admin";

  // Live pending count. Starts from server value, updated via realtime
  const [livePendingCount, setLivePendingCount] = useState(initialPendingCount);
  // Deduplicate events: track IDs recently processed to avoid double-counting
  // when both the realtime subscription and the DOM event fire for the same record.
  const processedIds = useRef(new Set<string>());
  // Suppress fetchCount for a short window after optimistic updates to prevent
  // a stale DB read from overwriting the optimistic value (which would then
  // cause the real realtime event to be deduped, leaving the count stuck).
  const suppressFetchUntil = useRef(0);

  const processEvent = useCallback((eventKey: string, apply: () => void) => {
    if (processedIds.current.has(eventKey)) return;
    processedIds.current.add(eventKey);
    apply();
    // Suppress fetchCount for 8s so a stale DB read cannot overwrite the optimistic value
    suppressFetchUntil.current = Date.now() + 8000;
    // Clear after 5s to avoid unbounded growth
    setTimeout(() => processedIds.current.delete(eventKey), 5000);
  }, []);

  // The initial server value seeds useState above. After mount, the client
  // fetchCount (runs immediately) and realtime events are the source of truth.
  // Syncing initialPendingCount here caused a race: a stale revalidation from
  // a prior approval could overwrite the already-decremented client count.

  // Listen for onboarding test request cleanup (admin deletes may not trigger Realtime)
  useEffect(() => {
    const handler = () => setLivePendingCount((prev) => Math.max(0, prev - 1));
    window.addEventListener("onboarding-test-deleted", handler);
    return () => window.removeEventListener("onboarding-test-deleted", handler);
  }, []);

  // Listen for approval-realtime CustomEvents dispatched by the dashboard.
  // These provide a secondary sync path for optimistic updates (e.g. approve/reject)
  // that bypass the realtime subscription.
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, record } = (e as CustomEvent).detail;
      const key = `${type}:${record.id}`;
      if (type === "INSERT" && record.status === "pending" && !record.archived_at && !record.is_log) {
        processEvent(key, () => setLivePendingCount((prev) => prev + 1));
      } else if (type === "DELETE" && record.status === "pending" && !record.is_log) {
        processEvent(key, () => setLivePendingCount((prev) => Math.max(0, prev - 1)));
      } else if (type === "UPDATE") {
        const oldRecord = (e as CustomEvent).detail.oldRecord;
        if (oldRecord && !record.is_log) {
          const wasPending = oldRecord.status === "pending" && !oldRecord.archived_at;
          const isPending = record.status === "pending" && !record.archived_at;
          if (wasPending && !isPending) {
            processEvent(key, () => setLivePendingCount((prev) => Math.max(0, prev - 1)));
          } else if (!wasPending && isPending) {
            processEvent(key, () => setLivePendingCount((prev) => prev + 1));
          }
        }
      }
    };
    window.addEventListener("approval-realtime", handler);
    return () => window.removeEventListener("approval-realtime", handler);
  }, [processEvent]);

  // Realtime: adjust pending count when approval requests are created/updated
  useRealtime<ApprovalRequest>({
    table: "approval_requests",
    filter: `org_id=eq.${currentOrgId}`,
    enabled: !!currentOrgId,
    onInsert: useCallback((record: ApprovalRequest) => {
      if (record.status === "pending" && !record.archived_at && !record.is_log) {
        processEvent(`INSERT:${record.id}`, () => setLivePendingCount((prev) => prev + 1));
      }
    }, [processEvent]),
    onUpdate: useCallback((record: ApprovalRequest, oldRecord: ApprovalRequest) => {
      if (record.is_log || oldRecord.is_log) return;
      const wasPending = oldRecord.status === "pending" && !oldRecord.archived_at;
      const isPending = record.status === "pending" && !record.archived_at;
      if (wasPending && !isPending) {
        processEvent(`UPDATE:${record.id}`, () => setLivePendingCount((prev) => Math.max(0, prev - 1)));
      } else if (!wasPending && isPending) {
        processEvent(`UPDATE:${record.id}`, () => setLivePendingCount((prev) => prev + 1));
      }
    }, [processEvent]),
    onDelete: useCallback((oldRecord: ApprovalRequest) => {
      if (oldRecord.status === "pending" && !oldRecord.is_log) {
        processEvent(`DELETE:${oldRecord.id}`, () => setLivePendingCount((prev) => Math.max(0, prev - 1)));
      }
    }, [processEvent]),
  });

  // Periodic count fetch: reconcile the badge with the actual DB count every 30s.
  // Catches any drift from missed realtime events and handles realtime failures.
  useEffect(() => {
    if (!currentOrgId) return;

    const fetchCount = async () => {
      if (document.visibilityState !== "visible") return;
      // Skip if a recent optimistic update is in flight. A stale DB read
      // during this window would overwrite the optimistic value and the
      // subsequent realtime event would be deduped, leaving the count stuck.
      if (Date.now() < suppressFetchUntil.current) return;
      try {
        const supabase = createClient();
        const { count } = await supabase
          .from("approval_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .is("archived_at", null)
          .or("is_log.is.null,is_log.eq.false");
        if (count !== null) setLivePendingCount(count);
      } catch {
        // Silently fail
      }
    };

    // Fetch immediately to correct any stale server-rendered count
    fetchCount();

    const interval = setInterval(fetchCount, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentOrgId]);

  const pendingCount = livePendingCount;

  // Measure available space and calculate how many items fit
  const calculateMaxItems = useCallback(() => {
    if (!sidebarRef.current || !navRef.current) return;

    // Measure the height of the first nav item to get actual item height
    const firstItem = navRef.current.querySelector('[data-nav-item]');
    const itemHeight = firstItem ? firstItem.getBoundingClientRect().height : 68;

    // Available height = nav container's allocated flex space
    const navRect = navRef.current.getBoundingClientRect();
    const availableHeight = navRect.height;

    const fitCount = Math.max(1, Math.floor(availableHeight / itemHeight));
    setMaxVisible(fitCount);
  }, []);

  // Re-measure whenever the sidebar resizes AND when maxVisible changes
  // (changing maxVisible changes what's rendered, which changes available space)
  const prevMaxRef = useRef(maxVisible);
  useEffect(() => {
    const timer = setTimeout(calculateMaxItems, 50);
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(calculateMaxItems);
    });
    if (sidebarRef.current) observer.observe(sidebarRef.current);

    // Stabilize: if maxVisible changed, recalculate once more
    if (prevMaxRef.current !== maxVisible) {
      prevMaxRef.current = maxVisible;
      requestAnimationFrame(calculateMaxItems);
    }

    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [calculateMaxItems, maxVisible]);

  const visibleItems = navItems.filter((item) => {
    if (item.appAdminOnly && !isAppAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  // First item (Org) is always shown above divider, rest dynamically overflow
  const remainingItems = visibleItems.slice(1);
  const overflowItems = remainingItems.slice(maxVisible);

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
    if (item.id === "home" && (pathname.startsWith("/org") || pathname === "/dashboard")) {
      return true;
    }
    if (item.id === "playground" && pathname.startsWith("/playground")) {
      return true;
    }
    if (item.id === "settings" && pathname.startsWith("/settings")) {
      return true;
    }
    if (item.id === "admin" && pathname.startsWith("/admin")) {
      return true;
    }
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
        <button key={item.id} data-nav-item onClick={() => handleNavClick(item)} className={classes}>
          {content}
        </button>
      );
    }

    return (
      <Link key={item.id} data-nav-item href={item.href} onClick={() => handleNavClick(item)} className={classes}>
        {content}
      </Link>
    );
  };

  return (
    <div className="flex h-full">
      {/* Icon bar */}
      <div ref={sidebarRef} className="sidebar-icon-bar flex h-full w-20 flex-col items-center">
        {/* Logo */}
        <Link
          href="/org/overview"
          className="mb-2 flex w-full items-center justify-center px-2 py-1"
          onClick={() => { setActivePanel(null); setMobileOpen(false); }}
        >
          <img src="/logo-icon.webp" alt="OKrunit" className="size-14 object-contain drop-shadow-md" />
        </Link>

        {/* First item (Org/Home), above divider like Make.com */}
        {visibleItems.length > 0 && renderNavItem(visibleItems[0])}

        {/* Divider between first item and rest */}
        <div className="mx-auto my-2 h-px w-7 bg-white/25" />

        {/* Remaining nav items, all rendered for measurement, overflow hidden */}
        <nav ref={navRef} className="flex w-full flex-1 flex-col items-center overflow-hidden">
          {remainingItems.slice(0, maxVisible).map((item) => renderNavItem(item))}
        </nav>

        {/* More button */}
        {overflowItems.length > 0 && (
          <div className="relative w-full pb-3">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              aria-label="More navigation options"
              aria-expanded={moreOpen}
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
                  <button onClick={() => setMoreOpen(false)} aria-label="Close menu" className="cursor-pointer text-muted-foreground hover:text-foreground">
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
});
