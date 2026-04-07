"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";
import { TOUR_STEPS, findPageTour } from "@/components/onboarding/tour-steps";
import { AlertTriangle, Menu, HelpCircle, LogOut, Settings, Check, ChevronsUpDown, Building2, Search, BookOpen, Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useOrgName } from "@/components/org/org-name-context";

interface OrgItem {
  id: string;
  org_id: string;
  org_name: string;
  role: string;
  is_default: boolean;
}

interface HeaderProps {
  emergencyStopActive: boolean;
  user?: {
    email: string;
    full_name: string | null;
  };
  orgName?: string;
  pendingCount?: number;
  currentOrgId?: string;
  userOrgs?: OrgItem[];
  userId?: string;
  currentPlan?: string;
}

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

export function Header({ emergencyStopActive, user, orgName: serverOrgName, pendingCount = 0, currentOrgId, userOrgs: serverUserOrgs = [], userId, currentPlan }: HeaderProps) {
  const router = useRouter();
  const { setMobileOpen } = useSidebarStore();
  const { getOrgName } = useOrgName();
  const [isMac, setIsMac] = useState(false);

  // Apply optimistic name overrides
  const orgName = currentOrgId ? getOrgName(currentOrgId, serverOrgName ?? "") : serverOrgName;
  const userOrgs = serverUserOrgs.map((org) => ({
    ...org,
    org_name: getOrgName(org.org_id, org.org_name),
  }));

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  const hasMultipleOrgs = userOrgs.length > 1;

  async function switchOrg(orgId: string) {
    if (orgId === currentOrgId) return;
    await fetch("/api/v1/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    });
    router.refresh();
  }

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header>
      {/* Emergency banner */}
      {emergencyStopActive && (
        <div className="emergency-banner flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white">
          <AlertTriangle className="size-4" />
          Emergency Stop Active. All approval requests are being held.
        </div>
      )}

      {/* Top bar */}
      <div className="top-bar flex items-center justify-between px-5">
        {/* Left: mobile menu + org name */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          {orgName && (
            hasMultipleOrgs ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold text-foreground outline-none transition-colors hover:bg-muted">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate max-w-[140px] sm:max-w-none">{orgName}</span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Organizations
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {userOrgs.map((org) => (
                    <DropdownMenuItem
                      key={org.org_id}
                      onClick={() => switchOrg(org.org_id)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                        {org.org_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 truncate">{org.org_name}</span>
                      {org.org_id === currentOrgId && <Check className="size-4 shrink-0 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-sm font-bold text-foreground truncate max-w-[140px] sm:max-w-none">{orgName}</span>
            )
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {/* Upgrade prompt for free users */}
          {currentPlan === "free" && (
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary">
              <Link href="/org/subscription#plans">
                <ArrowUpRight className="size-3.5" />
                <span className="hidden sm:inline text-xs font-medium">Upgrade</span>
              </Link>
            </Button>
          )}

          {/* Search / Cmd+K hint */}
          <button
            data-tour="search-bar"
            onClick={() => {
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="hidden sm:flex items-center gap-2.5 rounded-lg border border-border bg-white dark:bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground shadow-sm min-w-[200px]"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              {isMac ? <><span className="text-[14px] leading-none">⌘</span>K</> : "Ctrl+K"}
            </kbd>
          </button>

          {/* Help dropdown with contextual docs + tour */}
          <HelpDropdown />

          {/* Notification bell + panel */}
          <NotificationPanel pendingCount={pendingCount} userId={userId} />

          {/* User avatar dropdown */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex cursor-pointer items-center justify-center rounded-full outline-none ring-2 ring-primary/20 transition-shadow hover:ring-primary/40 focus-visible:ring-primary/50">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-white text-xs font-bold">
                      {getInitials(user.full_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.full_name ?? user.email}</p>
                  {user.full_name && (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings/account">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

function HelpDropdown() {
  const pathname = usePathname();
  const { fullTourActive, activePageId, tourPaused, touredPages, resumeTour } =
    useOnboardingTourStore();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentPageTour = mounted ? findPageTour(pathname) : undefined;
  const docsPath = currentPageTour?.docsPath ?? "/docs";
  const isTourActive = fullTourActive || !!activePageId;
  const hasTouredThisPage = currentPageTour ? touredPages.includes(currentPageTour.pageId) : false;

  const tourLabel = tourPaused
    ? "Resume Tour"
    : currentPageTour
      ? hasTouredThisPage ? "Restart Tour" : "Start Tour"
      : "Start Tour";

  const handleTour = () => {
    setOpen(false);
    if (tourPaused) {
      // Resume from where user left off
      resumeTour(currentPageTour?.pageId);
    } else if (currentPageTour) {
      resumeTour(currentPageTour.pageId);
    } else {
      // No tour for this page. Start the full tour
      useOnboardingTourStore.getState().startFullTour();
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
        data-tour-help-btn
      >
        <HelpCircle className="size-4" />
        <span className="hidden sm:inline text-xs">Help</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-white shadow-lg dark:bg-card z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <a
            href={docsPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            onClick={() => setOpen(false)}
          >
            <BookOpen className="size-4 text-muted-foreground" />
            Documentation
          </a>
          {!isTourActive && (
            <button
              onClick={handleTour}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Sparkles className="size-4 text-emerald-600" />
              {tourLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
