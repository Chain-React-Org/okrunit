"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Audit Log Table (Client Component)
// Paginated, filterable table displaying organization audit log entries.
// ---------------------------------------------------------------------------

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import type { AuditLogEntry } from "@/lib/types/database";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_VALUE = "__all__";

/** Map action strings to badge variants for visual distinction. */
function actionBadgeVariant(
  action: string
): "default" | "secondary" | "destructive" | "outline" {
  const lower = action.toLowerCase();
  if (lower.includes("delete") || lower.includes("revoke") || lower.includes("emergency")) {
    return "destructive";
  }
  if (lower.includes("create") || lower.includes("approve")) {
    return "default";
  }
  if (lower.includes("update") || lower.includes("rotate")) {
    return "secondary";
  }
  return "outline";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AuditLogTableProps {
  initialEntries: AuditLogEntry[];
  orgId?: string;
  pageSize?: number;
  userNames?: Record<string, string>;
  connectionNames?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogTable({
  initialEntries,
  orgId,
  pageSize = 50,
  userNames = {},
  connectionNames = {},
}: AuditLogTableProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries);
  const [hasMore, setHasMore] = useState(initialEntries.length >= pageSize);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [actionFilter, setActionFilter] = useState<string>(ALL_VALUE);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>(ALL_VALUE);

  // Expanded rows (track by entry id)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Derive unique action and resource_type values for filter dropdowns.
  const uniqueActions = useMemo(() => {
    const set = new Set(entries.map((e) => e.action));
    return Array.from(set).sort();
  }, [entries]);

  const uniqueResourceTypes = useMemo(() => {
    const set = new Set(entries.map((e) => e.resource_type));
    return Array.from(set).sort();
  }, [entries]);

  // Apply client-side filters.
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (actionFilter !== ALL_VALUE && entry.action !== actionFilter) {
        return false;
      }
      if (
        resourceTypeFilter !== ALL_VALUE &&
        entry.resource_type !== resourceTypeFilter
      ) {
        return false;
      }
      return true;
    });
  }, [entries, actionFilter, resourceTypeFilter]);

  // Toggle row expansion.
  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Load more entries from Supabase.
  const loadMore = useCallback(() => {
    startTransition(async () => {
      const supabase = createClient();
      const lastEntry = entries[entries.length - 1];
      if (!lastEntry) return;

      let query = supabase
        .from("audit_log")
        .select("*")
        .lt("created_at", lastEntry.created_at)
        .order("created_at", { ascending: false })
        .limit(pageSize);

      if (orgId) {
        query = query.eq("org_id", orgId);
      }

      const { data } = await query.returns<AuditLogEntry[]>();

      if (data) {
        setEntries((prev) => [...prev, ...data]);
        if (data.length < pageSize) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    });
  }, [entries, orgId, pageSize]);

  // Reset filters.
  const clearFilters = useCallback(() => {
    setActionFilter(ALL_VALUE);
    setResourceTypeFilter(ALL_VALUE);
  }, []);

  const hasActiveFilters =
    actionFilter !== ALL_VALUE || resourceTypeFilter !== ALL_VALUE;

  function exportCsv() {
    const headers = ["Timestamp", "Action", "Resource Type", "Resource ID", "User ID", "Connection ID", "IP Address", "Details"];
    const rows = filteredEntries.map((entry) =>
      [
        new Date(entry.created_at).toISOString(),
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.user_id ?? "",
        entry.connection_id ?? "",
        entry.ip_address ?? "",
        entry.details ? JSON.stringify(entry.details).replace(/"/g, '""') : "",
      ]
        .map((v) => `"${v}"`)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okrunit-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredEntries.length} entries exported`);
  }

  return (
    <div className="space-y-4">
      {/* ---- Filters ---- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white text-gray-900">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All actions</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={resourceTypeFilter}
          onValueChange={setResourceTypeFilter}
        >
          <SelectTrigger className="w-full sm:w-[200px] bg-white text-gray-900">
            <SelectValue placeholder="All resource types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All resource types</SelectItem>
            {uniqueResourceTypes.map((rt) => (
              <SelectItem key={rt} value={rt}>
                {rt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {filteredEntries.length} of {entries.length} entries
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={filteredEntries.length === 0}
            className="gap-1.5 bg-white text-gray-900 hover:bg-gray-50"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ---- Table ---- */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-xl border-0 py-20 text-center shadow-[var(--shadow-card)]">
          <div className="empty-state-icon rounded-2xl p-5">
            <FileText className="size-9 text-muted-foreground/70" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">No audit log entries found</p>
            {hasActiveFilters && (
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters to see more results.
              </p>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource Type</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>User / Connection</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const isExpanded = expandedRows.has(entry.id);
                const hasDetails =
                  entry.details !== null &&
                  Object.keys(entry.details).length > 0;
                const actor = entry.user_id
                  ? userNames[entry.user_id] ?? `User: ${entry.user_id.slice(0, 8)}...`
                  : entry.connection_id
                    ? connectionNames[entry.connection_id] ?? `Conn: ${entry.connection_id.slice(0, 8)}...`
                    : "System";

                return (
                  <Fragment key={entry.id}>
                    <TableRow className="group">
                      {/* Expand toggle */}
                      <TableCell>
                        {hasDetails ? (
                          <button
                            type="button"
                            onClick={() => toggleRow(entry.id)}
                            className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
                            aria-label={
                              isExpanded
                                ? "Collapse details"
                                : "Expand details"
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        ) : null}
                      </TableCell>

                      {/* Timestamp */}
                      <TableCell
                        className="text-muted-foreground text-xs"
                        title={new Date(entry.created_at).toLocaleString()}
                      >
                        {formatDistanceToNow(new Date(entry.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>

                      {/* Action */}
                      <TableCell>
                        <Badge variant={actionBadgeVariant(entry.action)}>
                          {entry.action}
                        </Badge>
                      </TableCell>

                      {/* Resource Type */}
                      <TableCell className="text-sm">
                        {entry.resource_type}
                      </TableCell>

                      {/* Resource ID */}
                      <TableCell
                        className="text-muted-foreground max-w-[160px] truncate font-mono text-xs"
                        title={entry.resource_id}
                      >
                        {entry.resource_id}
                      </TableCell>

                      {/* User / Connection */}
                      <TableCell
                        className="text-muted-foreground text-xs"
                        title={
                          entry.user_id ?? entry.connection_id ?? undefined
                        }
                      >
                        {actor}
                      </TableCell>

                      {/* IP Address */}
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {entry.ip_address ?? "-"}
                      </TableCell>
                    </TableRow>

                    {/* Expanded details row */}
                    {isExpanded && hasDetails && (
                      <TableRow key={`details-${entry.id}`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="px-6 py-4">
                            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                              Details
                            </p>
                            <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---- Load More ---- */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isPending}
            className="bg-white text-gray-900 hover:bg-gray-50"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
