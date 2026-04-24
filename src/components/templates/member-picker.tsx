"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Member Picker
// Multi-select combobox for choosing org members as approvers.
// ---------------------------------------------------------------------------

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { titleCaseName } from "@/lib/format-name";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  can_approve: boolean;
}

interface MemberPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberPicker({ selectedIds, onChange }: MemberPickerProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch members on first open
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !fetchedRef.current) {
      fetchedRef.current = true;
      setLoading(true);
      fetch("/api/v1/team/members")
        .then((res) => res.json())
        .then((data) => setMembers(data.data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  const toggle = useCallback(
    (id: string) => {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((s) => s !== id)
          : [...selectedIds, id],
      );
    },
    [selectedIds, onChange],
  );

  const remove = useCallback(
    (id: string) => {
      onChange(selectedIds.filter((s) => s !== id));
    },
    [selectedIds, onChange],
  );

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return "Owner";
      case "admin": return "Admin";
      case "approver": return "Approver";
      default: return "Member";
    }
  };

  return (
    <div className="space-y-2">
      {/* Selected member badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const m = memberMap.get(id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {m ? (titleCaseName(m.full_name) ?? m.email) : id.slice(0, 8)}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  onClick={() => remove(id)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Combobox trigger */}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-white font-normal dark:bg-card"
          >
            <span className="text-muted-foreground">
              {selectedIds.length === 0
                ? "Select approvers..."
                : `${selectedIds.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name, email, or role..." />
            <CommandList>
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading members...
                </div>
              )}
              {!loading && members.length === 0 && fetchedRef.current && (
                <CommandEmpty>No members found.</CommandEmpty>
              )}
              {!loading && members.length > 0 && (
                <CommandGroup>
                  {members.map((m) => {
                    const isSelected = selectedIds.includes(m.id);
                    const label = titleCaseName(m.full_name) ?? m.email;
                    // Keywords let cmdk match on role and email even though they aren't in the displayed text
                    const keywords = [m.email, m.role, roleLabel(m.role)];
                    if (m.full_name) keywords.push(m.full_name);

                    return (
                      <CommandItem
                        key={m.id}
                        value={m.id}
                        keywords={keywords}
                        onSelect={() => toggle(m.id)}
                      >
                        <div className={cn(
                          "mr-2 flex size-4 items-center justify-center rounded-sm border",
                          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                        )}>
                          {isSelected && <Check className="size-3" />}
                        </div>
                        <UserAvatar
                          fullName={m.full_name}
                          email={m.email}
                          avatarUrl={m.avatar_url}
                          size="sm"
                          className="mr-2 size-6"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {m.full_name ? m.email : ""}{m.full_name && " · "}{roleLabel(m.role)}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
