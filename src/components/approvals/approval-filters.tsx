"use client";

import { memo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Archive } from "lucide-react";
import { SOURCE_CONFIG, AVAILABLE_SOURCES } from "@/components/approvals/source-icons";
import type { Connection } from "@/lib/types/database";

interface ApprovalFiltersProps {
  onFilterChange: (filters: {
    status?: string;
    priority?: string;
    search?: string;
    connectionId?: string;
    source?: string;
    showArchived?: boolean;
  }) => void;
  connections: Connection[];
  currentFilters: {
    status?: string;
    priority?: string;
    search?: string;
    connectionId?: string;
    source?: string;
    showArchived?: boolean;
  };
}

export const ApprovalFilters = memo(function ApprovalFilters({
  onFilterChange,
  connections,
  currentFilters,
}: ApprovalFiltersProps) {
  const hasActiveFilters = currentFilters.status || currentFilters.priority || currentFilters.search || currentFilters.connectionId || currentFilters.source || currentFilters.showArchived;

  return (
    <div className="rounded-lg bg-white dark:bg-card p-4 border border-border/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search approvals..."
            value={currentFilters.search ?? ""}
            onChange={(e) =>
              onFilterChange({ ...currentFilters, search: e.target.value })
            }
            className="h-9 border border-border/50 bg-white dark:bg-card text-foreground pl-9 text-sm shadow-[var(--shadow-xs)]"
          />
        </div>

        <Select
          value={currentFilters.status ?? "all"}
          onValueChange={(value) =>
            onFilterChange({
              ...currentFilters,
              status: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="h-9 w-full border border-border/50 bg-white dark:bg-card text-foreground text-sm shadow-[var(--shadow-xs)] sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.priority ?? "all"}
          onValueChange={(value) =>
            onFilterChange({
              ...currentFilters,
              priority: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="h-9 w-full border border-border/50 bg-white dark:bg-card text-foreground text-sm shadow-[var(--shadow-xs)] sm:w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.source ?? "all"}
          onValueChange={(value) =>
            onFilterChange({
              ...currentFilters,
              source: value === "all" ? undefined : value,
            })
          }
        >
          <SelectTrigger className="h-9 w-full border border-border/50 bg-white dark:bg-card text-foreground text-sm shadow-[var(--shadow-xs)] sm:w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(SOURCE_CONFIG)
              .filter(([key]) => AVAILABLE_SOURCES.has(key))
              .map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {connections.length > 0 && (
          <Select
            value={currentFilters.connectionId ?? "all"}
            onValueChange={(value) =>
              onFilterChange({
                ...currentFilters,
                connectionId: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="h-9 w-full border border-border/50 bg-white dark:bg-card text-foreground text-sm shadow-[var(--shadow-xs)] sm:w-[160px]">
              <SelectValue placeholder="Connection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Connections</SelectItem>
              {connections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant={currentFilters.showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() =>
            onFilterChange({
              ...currentFilters,
              showArchived: !currentFilters.showArchived,
            })
          }
          className="h-9 gap-1.5 text-xs border-border/50 bg-white dark:bg-card text-foreground shadow-[var(--shadow-xs)]"
        >
          <Archive className="size-3.5" />
          {currentFilters.showArchived ? "Showing Archived" : "Show Archived"}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onFilterChange({
                status: undefined,
                priority: undefined,
                search: undefined,
                connectionId: undefined,
                source: undefined,
                showArchived: false,
              })
            }
            className="h-9 gap-1 text-xs"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
});
