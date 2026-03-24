"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, Menu, HelpCircle, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HeaderProps {
  emergencyStopActive: boolean;
  user?: {
    email: string;
    full_name: string | null;
  };
}

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/connections": "Connections",
  "/rules": "Rules",
  "/webhooks": "Webhooks",
  "/playground": "API Playground",
  "/team": "Team",
  "/messaging": "Messaging",
  "/analytics": "Analytics",
  "/audit-log": "Audit Log",
  "/organization": "Organization",
  "/settings": "Settings",
  "/settings/oauth": "OAuth Apps",
  "/emergency": "Emergency Stop",
  "/admin": "Admin",
  "/setup": "Setup",
};

function getPageTitle(pathname: string): string {
  // Try exact match first
  if (routeLabels[pathname]) return routeLabels[pathname];
  // Try parent path
  const parent = pathname.split("/").slice(0, -1).join("/");
  if (routeLabels[parent]) return routeLabels[parent];
  // Fallback to last segment
  const last = pathname.split("/").pop() ?? "";
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
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

export function Header({ emergencyStopActive, user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setMobileOpen } = useSidebarStore();
  const pageTitle = getPageTitle(pathname);

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
          Emergency Stop Active — All approval requests are being held.
        </div>
      )}

      {/* Top bar */}
      <div className="top-bar flex items-center justify-between px-4">
        {/* Left: mobile menu + page title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground">{pageTitle}</h2>
        </div>

        {/* Right: help + user */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            className="text-muted-foreground hover:text-foreground"
          >
            <a href="https://okrunit.com/docs" target="_blank" rel="noopener noreferrer" title="Help & Docs">
              <HelpCircle className="size-4" />
            </a>
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="rounded-full">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {getInitials(user.full_name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
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
                  <Link href="/settings">
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
