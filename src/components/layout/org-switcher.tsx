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
}

export function OrgSwitcher({ currentOrgId, orgs }: OrgSwitcherProps) {
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

  // If only one org, just show the name without a dropdown
  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-primary shrink-0" />
        <span className="text-foreground truncate text-base font-semibold">
          {currentOrg?.org_name ?? "No organization"}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 text-base font-semibold text-foreground hover:text-primary transition-colors outline-none max-w-[170px] -mx-2 px-2 py-1 rounded hover:bg-[var(--sidebar-accent)]/60">
        <Building2 className="size-4 shrink-0" />
        <span className="truncate">{currentOrg?.org_name}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-60 ml-auto" />
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
            {org.org_id === currentOrgId && (
              <Check className="size-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
