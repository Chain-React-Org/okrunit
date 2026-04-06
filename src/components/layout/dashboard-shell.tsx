"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () => import("@/components/layout/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);
import { TourController } from "@/components/onboarding/tour-controller";
import { useSidebarStore } from "@/stores/sidebar-store";
import { OrgNameProvider } from "@/components/org/org-name-context";

interface DashboardShellProps {
  children: React.ReactNode;
  sidebarProps: React.ComponentProps<typeof Sidebar>;
  emergencyStopActive: boolean;
  user: { email: string; full_name: string | null };
  orgName: string;
  pendingCount: number;
  currentOrgId: string;
  userOrgs: { id: string; org_id: string; org_name: string; role: string; is_default: boolean }[];
  userId: string;
}

export function DashboardShell({ children, sidebarProps, emergencyStopActive, user, orgName, pendingCount, currentOrgId, userOrgs, userId }: DashboardShellProps) {
  const { mobileOpen, setMobileOpen, setActivePanel } = useSidebarStore();

  // Close mobile sidebar on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setActivePanel(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [setMobileOpen, setActivePanel]);

  return (
    <OrgNameProvider>
    <div className="gk-v2 flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <NavigationProgress />
      <CommandPalette orgId={currentOrgId} />
      <TourController />

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => { setMobileOpen(false); setActivePanel(null); }}
        />
      )}

      {/* Sidebar — desktop: always visible, mobile: slide-in overlay */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar {...sidebarProps} />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Skip to main content — accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to main content
        </a>
        <Header
          emergencyStopActive={emergencyStopActive}
          user={user}
          orgName={orgName}
          pendingCount={pendingCount}
          currentOrgId={currentOrgId}
          userOrgs={userOrgs}
          userId={userId}
        />
        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>
      </div>
    </div>
    </OrgNameProvider>
  );
}
