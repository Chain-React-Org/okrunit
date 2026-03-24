"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface OrgSwitcherProps {
  currentOrgId: string;
  orgs: { id: string; org_id: string; org_name: string; role: string; is_default: boolean }[];
  collapsed?: boolean;
}

export function OrgSwitcher({ currentOrgId, orgs, collapsed }: OrgSwitcherProps) {
  const router = useRouter();
  const currentOrg = orgs.find((o) => o.org_id === currentOrgId);

  async function switchOrg(orgId: string) {
    if (orgId === currentOrgId) return;

    await fetch("/api/v1/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    });

    router.refresh();
  }

  const orgInitial = (currentOrg?.org_name ?? "?").charAt(0).toUpperCase();

  // Collapsed: show just the initial in a circle
  if (collapsed) {
    if (orgs.length <= 1) {
      return (
        <div
          className="flex size-8 items-center justify-center rounded-full bg-[var(--sidebar-accent)] text-xs font-semibold text-[var(--sidebar-accent-foreground)]"
          title={currentOrg?.org_name ?? "No organization"}
        >
          {orgInitial}
        </div>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-[var(--sidebar-accent)] text-xs font-semibold text-[var(--sidebar-accent-foreground)] outline-none transition-colors hover:bg-[var(--sidebar-primary)]/20"
          title={currentOrg?.org_name}
        >
          {orgInitial}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs">
            <Building2 className="size-3.5" />
            Organizations
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.org_id}
              onClick={() => switchOrg(org.org_id)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                org.org_id === currentOrgId && "font-medium",
              )}
            >
              <span className="flex-1 truncate">{org.org_name}</span>
              {org.org_id === currentOrgId && <Check className="size-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Expanded: show full org name
  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-1">
        <div className="flex size-6 shrink-0 items-center justify-center rounded bg-[var(--sidebar-accent)] text-[10px] font-semibold text-[var(--sidebar-accent-foreground)]">
          {orgInitial}
        </div>
        <span className="truncate text-sm font-semibold text-[var(--sidebar-accent-foreground)]">
          {currentOrg?.org_name ?? "No organization"}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-[var(--sidebar-accent-foreground)] outline-none transition-colors hover:bg-[var(--sidebar-accent)]">
        <div className="flex size-6 shrink-0 items-center justify-center rounded bg-[var(--sidebar-accent)] text-[10px] font-semibold">
          {orgInitial}
        </div>
        <span className="flex-1 truncate text-left">{currentOrg?.org_name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <Building2 className="size-3.5" />
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.org_id}
            onClick={() => switchOrg(org.org_id)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              org.org_id === currentOrgId && "font-medium",
            )}
          >
            <span className="flex-1 truncate">{org.org_name}</span>
            {org.org_id === currentOrgId && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
